resource "aws_bedrock_guardrail" "pii_masking" {
  name        = var.guardrail_name
  description = "Jira/Confluence の MCP ツール結果から顧客情報をマスクする"

  # ANONYMIZE のみの構成でもブロック時メッセージは必須引数
  blocked_input_messaging   = "機密情報が含まれているため処理できません。"
  blocked_outputs_messaging = "機密情報が含まれているため応答できません。"

  sensitive_information_policy_config {
    # action だけの指定ではマスクが出力側評価にしか適用されないため、
    # input_action / input_enabled で入力側（source=INPUT）のマスクを明示する
    dynamic "pii_entities_config" {
      for_each = var.pii_entity_types

      content {
        type           = pii_entities_config.value
        action         = "ANONYMIZE"
        input_action   = "ANONYMIZE"
        input_enabled  = true
        output_action  = "ANONYMIZE"
        output_enabled = true
      }
    }

    # 正規表現フィルタは ML ベースの PII エンティティと異なり課金対象外
    dynamic "regexes_config" {
      for_each = var.regex_filters

      content {
        name           = regexes_config.value.name
        description    = regexes_config.value.description
        pattern        = regexes_config.value.pattern
        action         = "ANONYMIZE"
        input_action   = "ANONYMIZE"
        input_enabled  = true
        output_action  = "ANONYMIZE"
        output_enabled = true
      }
    }
  }
}

resource "aws_bedrock_guardrail_version" "pii_masking" {
  guardrail_arn = aws_bedrock_guardrail.pii_masking.guardrail_arn
  description   = "初版"
}

# プロキシ利用者に配る最小権限ポリシー。モデル呼び出し権限は含めない。
# IAM Identity Center の Permission Set やグループへの割り当ては環境依存のため、
# ここではポリシー定義のみを管理する。
data "aws_iam_policy_document" "apply_guardrail" {
  statement {
    sid       = "ApplyGuardrailOnly"
    actions   = ["bedrock:ApplyGuardrail"]
    resources = [aws_bedrock_guardrail.pii_masking.guardrail_arn]
  }
}

resource "aws_iam_policy" "apply_guardrail" {
  name        = "${var.guardrail_name}-apply"
  description = "マスキングプロキシ MCP の利用者向け: 対象 Guardrail への ApplyGuardrail のみ許可"
  policy      = data.aws_iam_policy_document.apply_guardrail.json
}
