variable "aws_region" {
  description = "Guardrail を作成する AWS リージョン。機微情報フィルタは東京リージョンで利用可能"
  type        = string
  default     = "ap-northeast-1"
}

variable "guardrail_name" {
  description = "Guardrail の名前"
  type        = string
  default     = "jira-confluence-pii-masking"
}

variable "pii_entity_types" {
  description = "マスク対象のマネージド PII エンティティ。指定できる値は https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-sensitive-filters.html を参照"
  type        = list(string)
  default = [
    "NAME",
    "EMAIL",
    "PHONE",
    "ADDRESS",
    "AGE",
    "CREDIT_DEBIT_CARD_NUMBER",
  ]
}

variable "regex_filters" {
  description = "マネージドエンティティで拾えない情報を補うカスタム正規表現。lookaround は使えない点に注意"
  type = list(object({
    name        = string
    description = string
    pattern     = string
  }))
  default = [
    {
      name        = "customer-id"
      description = "顧客管理システムの顧客 ID（架空のフォーマット）"
      pattern     = "CUST-\\d{6}"
    },
    {
      name        = "jp-postal-code"
      description = "日本の郵便番号"
      pattern     = "〒?\\d{3}-\\d{4}"
    },
    {
      name        = "jp-my-number"
      description = "マイナンバー（12桁、4桁区切りの空白・ハイフン許容）"
      pattern     = "\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}"
    },
  ]
}
