resource "aws_bedrock_guardrail" "pii_masking" {
  name        = var.guardrail_name
  description = "Jira/Confluence の MCP ツール結果から顧客情報をマスクする"

  # ANONYMIZE のみの構成でもブロック時メッセージは必須引数
  blocked_input_messaging   = "機密情報が含まれているため処理できません。"
  blocked_outputs_messaging = "機密情報が含まれているため応答できません。"

  sensitive_information_policy_config {
    dynamic "pii_entities_config" {
      for_each = var.pii_entity_types

      content {
        type   = pii_entities_config.value
        action = "ANONYMIZE"
      }
    }

    # 正規表現フィルタは ML ベースの PII エンティティと異なり課金対象外
    dynamic "regexes_config" {
      for_each = var.regex_filters

      content {
        name        = regexes_config.value.name
        description = regexes_config.value.description
        pattern     = regexes_config.value.pattern
        action      = "ANONYMIZE"
      }
    }
  }
}

resource "aws_bedrock_guardrail_version" "pii_masking" {
  guardrail_arn = aws_bedrock_guardrail.pii_masking.guardrail_arn
  description   = "初版"
}
