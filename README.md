# bedrock-guardrails-mcp-proxy

Amazon Bedrock Guardrails（ApplyGuardrail API）でツール結果の顧客情報をマスキングする MCP プロキシサーバの検証プロジェクトです。

Claude Code / Claude Desktop と Atlassian 公式 Remote MCP Server の間にプロキシとして挟み、Jira / Confluence から取得したテキストに含まれる PII（氏名・メールアドレス・電話番号など）を LLM のコンテキストに入る前にマスクします。

```
Claude Code / Desktop
        │
        ▼
マスキングプロキシ MCP（本リポジトリ）
        │  tools/call の結果を ApplyGuardrail でマスク
        ▼
Atlassian 公式 Remote MCP Server（Jira / Confluence）
```

解説記事: <https://zenn.dev/inventit/articles/bedrock-guardrails-mcp-proxy>（執筆中）

## 構成

- `terraform/` — Bedrock Guardrails（機微情報フィルタ + カスタム正規表現）の定義
- `proxy/` — マスキングプロキシ MCP サーバ（TypeScript）※今後追加

## Guardrail のデプロイ

```shell
cd terraform
terraform init
terraform plan
terraform apply
```

`guardrail_id` と `guardrail_version` が出力されるので、プロキシ MCP サーバの環境変数に設定します（プロキシ実装は今後追加）。

## License

MIT
