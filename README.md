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
- `proxy/` — マスキングプロキシ MCP サーバ（TypeScript）
- `apm.yml` — APM Marketplace 掲載用のパッケージ定義

## Guardrail のデプロイ

```shell
cd terraform
terraform init
terraform plan
terraform apply
```

`guardrail_id` と `guardrail_version` が出力されるので、プロキシ MCP サーバの環境変数に設定します。

## プロキシのビルドと動作確認

```shell
cd proxy
npm ci
npm run build

# スモークテスト（ApplyGuardrail を呼べる AWS 認証情報が必要）
AWS_PROFILE=<profile> GUARDRAIL_ID=<id> GUARDRAIL_VERSION=<version> npm run smoke
```

## Claude Code への登録例

`GUARDRAIL_ID` / `GUARDRAIL_VERSION`（`terraform output` の値）と、ApplyGuardrail を呼べる AWS プロファイルを環境変数で渡します。

```shell
claude mcp add jira-confluence-masked \
  --env GUARDRAIL_ID=<id> \
  --env GUARDRAIL_VERSION=<version> \
  --env AWS_PROFILE=<profile> \
  -- node /path/to/bedrock-guardrails-mcp-proxy/proxy/dist/index.js
```

これらの環境変数を設定しても、**初回起動時には Atlassian 側の OAuth 認証が別途発生します**。プロキシが内部で使う mcp-remote がブラウザを開くので、Atlassian アカウントで認可してください。トークンは `~/.mcp-auth` にキャッシュされるので、ブラウザが開くのは初回だけです。

`GUARDRAIL_ID` を設定せずに起動した場合、プロキシは接続エラーにはならず、`proxy_setup_required` という設定エラーを説明するツールだけを公開する縮退モードで起動します。MCP クライアント側のツール一覧から原因を確認できます。

## 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `GUARDRAIL_ID` | （必須） | ApplyGuardrail に渡す Guardrail ID。`terraform output` で確認 |
| `GUARDRAIL_VERSION` | `DRAFT` | Guardrail のバージョン（数字のみ）。運用では固定バージョンを推奨 |
| `AWS_PROFILE` | なし | ApplyGuardrail を呼べる AWS プロファイル。未指定時は AWS SDK の既定の解決順（環境変数 → プロファイル → SSO キャッシュ） |
| `AWS_REGION` | `ap-northeast-1` | Guardrail のリージョン |
| `UPSTREAM_MCP_URL` | Atlassian 公式 Remote MCP | 上流の Remote MCP エンドポイント（mcp-remote 経由で接続） |
| `UPSTREAM_COMMAND` | なし | 指定すると任意の stdio MCP サーバを上流にする（テスト・別上流用） |

## License

MIT
