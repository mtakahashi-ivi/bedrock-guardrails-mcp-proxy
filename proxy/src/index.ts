#!/usr/bin/env node
/**
 * guardrails-masking-proxy
 *
 * MCP クライアント（Claude Code 等）と上流 MCP サーバ（Atlassian 公式 Remote MCP 等）の
 * 間に立ち、tools/call の結果テキストを Bedrock Guardrails の ApplyGuardrail API で
 * マスクしてから返すプロキシ MCP サーバ。
 *
 * 設計上の約束事:
 * - fail-closed: ApplyGuardrail が呼べない・結果が解釈できない場合は、
 *   ツール結果を素通しせずエラーを返す
 * - マスクできない非テキストコンテンツ（画像等）と structuredContent は除去する
 * - ログ（stderr）にはマスク前のテキストや検出値を出さない
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ApplyGuardrailCommand,
  BedrockRuntimeClient,
} from "@aws-sdk/client-bedrock-runtime";

const GUARDRAIL_ID = process.env.GUARDRAIL_ID;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION ?? "DRAFT";
const AWS_REGION = process.env.AWS_REGION ?? "ap-northeast-1";
const UPSTREAM_MCP_URL =
  process.env.UPSTREAM_MCP_URL ?? "https://mcp.atlassian.com/v1/mcp/authv2";
// テスト・別上流用: 指定するとこのコマンドを stdio 上流として起動する
const UPSTREAM_COMMAND = process.env.UPSTREAM_COMMAND;

// ApplyGuardrail は 1 テキストユニット = 最大 1,000 文字。長いツール結果は
// 分割して順に適用する（1 呼び出しあたりの上限に収める保守的なサイズ）
const CHUNK_CHARS = 20_000;

if (!GUARDRAIL_ID) {
  console.error("[proxy] 環境変数 GUARDRAIL_ID が未設定です");
  process.exit(1);
}

const bedrock = new BedrockRuntimeClient({ region: AWS_REGION });

async function maskText(text: string): Promise<string> {
  if (text.length === 0) return text;
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_CHARS) {
    const chunk = text.slice(i, i + CHUNK_CHARS);
    const res = await bedrock.send(
      new ApplyGuardrailCommand({
        guardrailIdentifier: GUARDRAIL_ID,
        guardrailVersion: GUARDRAIL_VERSION,
        source: "INPUT",
        content: [{ text: { text: chunk } }],
      }),
    );
    if (res.action === "GUARDRAIL_INTERVENED") {
      const masked = res.outputs?.map((o) => o.text ?? "").join("");
      if (!masked) {
        // 介入したのにマスク済みテキストが返らないケースを素通しにしない
        throw new Error("ApplyGuardrail intervened but returned no output");
      }
      parts.push(masked);
    } else {
      parts.push(chunk);
    }
  }
  return parts.join("");
}

type ContentItem = { type: string; text?: string; [key: string]: unknown };

async function maskToolResult(result: {
  content?: ContentItem[];
  structuredContent?: unknown;
  isError?: boolean;
}): Promise<{ content: ContentItem[]; isError?: boolean }> {
  const content: ContentItem[] = [];
  for (const item of result.content ?? []) {
    if (item.type === "text" && typeof item.text === "string") {
      content.push({ type: "text", text: await maskText(item.text) });
    } else {
      // 画像や埋め込みリソースはマスクできないため、通さない
      content.push({
        type: "text",
        text: `[proxy] 非テキストコンテンツ（${item.type}）はマスクできないため除去しました`,
      });
    }
  }
  // structuredContent も LLM に渡るため、マスクを通せない以上は返さない
  return { content, isError: result.isError };
}

async function main() {
  const upstreamTransport = UPSTREAM_COMMAND
    ? new StdioClientTransport({
        command: UPSTREAM_COMMAND.split(" ")[0],
        args: UPSTREAM_COMMAND.split(" ").slice(1),
      })
    : new StdioClientTransport({
        // OAuth（ブラウザ認証・トークン保管・リフレッシュ）は mcp-remote に委譲する
        command: "npx",
        args: ["mcp-remote", UPSTREAM_MCP_URL],
      });

  const upstream = new Client({
    name: "guardrails-masking-proxy",
    version: "1.0.0",
  });
  await upstream.connect(upstreamTransport);
  console.error(
    `[proxy] upstream connected (${UPSTREAM_COMMAND ?? UPSTREAM_MCP_URL})`,
  );

  const server = new Server(
    { name: "guardrails-masking-proxy", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return await upstream.listTools();
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const result = await upstream.callTool({
      name: req.params.name,
      arguments: req.params.arguments,
    });
    try {
      return await maskToolResult(result as Parameters<typeof maskToolResult>[0]);
    } catch (e) {
      // fail-closed: マスクに失敗したら結果を返さない。元テキストや検出値は
      // エラーメッセージに含めない
      const reason = e instanceof Error ? e.name : "UnknownError";
      console.error(`[proxy] masking failed: ${reason}`);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `[proxy] ApplyGuardrail によるマスキングに失敗したため、ツール結果を破棄しました（${reason}）。` +
              "AWS 認証情報の期限切れの場合は aws sso login を実行してください。",
          },
        ],
      };
    }
  });

  await server.connect(new StdioServerTransport());
  console.error("[proxy] ready");
}

main().catch((e) => {
  console.error("[proxy] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
