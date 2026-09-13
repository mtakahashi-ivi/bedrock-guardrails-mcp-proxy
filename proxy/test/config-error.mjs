// 設定不備（GUARDRAIL_ID 未設定）のときの縮退モードのテスト。
// プロセスが即終了（= クライアントには "Connection closed"）せず、
// 設定エラーを説明するツールを公開したまま接続を維持することを確認する。
// AWS 認証情報は不要:
//   npm run test:config-error
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  // GUARDRAIL_ID を渡さない（PATH だけ引き継ぐ）
  env: { PATH: process.env.PATH ?? "" },
  stderr: "inherit",
});

const client = new Client({ name: "config-error-test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
assert.strictEqual(tools.length, 1, "縮退モードではツールが 1 つだけ公開されること");
assert.strictEqual(tools[0].name, "proxy_setup_required");
assert.ok(
  tools[0].description.includes("GUARDRAIL_ID"),
  "ツール説明に未設定の環境変数名が含まれること",
);

const result = await client.callTool({ name: "proxy_setup_required", arguments: {} });
assert.ok(result.isError, "縮退モードのツール呼び出しは isError で返ること");
assert.ok(
  result.content[0].text.includes("GUARDRAIL_ID"),
  "エラーメッセージに未設定の環境変数名が含まれること",
);
console.log("tool description:", tools[0].description);

await client.close();
console.log("config-error test: OK");
