output "guardrail_arn" {
  description = "作成した Guardrail の ARN"
  value       = aws_bedrock_guardrail.pii_masking.guardrail_arn
}

output "guardrail_id" {
  description = "ApplyGuardrail API に渡す Guardrail ID"
  value       = aws_bedrock_guardrail.pii_masking.guardrail_id
}

output "guardrail_version" {
  description = "ApplyGuardrail API に渡す Guardrail バージョン"
  value       = aws_bedrock_guardrail_version.pii_masking.version
}
