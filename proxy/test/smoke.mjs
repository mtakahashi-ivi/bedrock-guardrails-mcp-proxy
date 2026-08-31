// エンドツーエンドのスモークテスト。
// ダミー上流を挟んだプロキシを起動し、ツール結果がマスクされて返ることを確認する。
// 実行には ApplyGuardrail を呼べる AWS 認証情報と GUARDRAIL_ID / GUARDRAIL_VERSION が必要:
//   AWS_PROFILE=xxx GUARDRAIL_ID=xxx GUARDRAIL_VERSION=n npm run smoke
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const env = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined),
);

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...env, UPSTREAM_COMMAND: "node test/dummy-upstream.mjs" },
  stderr: "inherit",
});

const client = new Client({ name: "smoke-test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
assert.ok(
  tools.some((t) => t.name === "get_ticket"),
  "tools/list が上流のツールを中継していること",
);

const result = await client.callTool({ name: "get_ticket", arguments: {} });
const text = result.content[0].text;
console.log("masked:", text);

assert.ok(!result.isError, "ツール呼び出しがエラーになっていないこと");
assert.ok(!text.includes("山田太郎"), "氏名がマスクされていること");
assert.ok(!text.includes("taro.yamada"), "メールがマスクされていること");
assert.ok(!text.includes("090-1234"), "電話番号がマスクされていること");
assert.ok(!text.includes("CUST-012345"), "顧客 ID がマスクされていること");
assert.ok(text.includes("{NAME}"), "プレースホルダに置換されていること");

await client.close();
console.log("smoke test: OK");
