// スモークテスト用のダミー上流 MCP サーバ。
// 架空の PII を含むサポートチケットを返す get_ticket ツールだけを公開する。
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "dummy-upstream", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_ticket",
      description: "架空の PII を含むダミーのサポートチケットを返す",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async () => ({
  content: [
    {
      type: "text",
      text: "山田太郎様（メール: taro.yamada@example.com、電話: 090-1234-5678、顧客ID: CUST-012345）よりログイン不可の問い合わせ",
    },
  ],
}));

await server.connect(new StdioServerTransport());
