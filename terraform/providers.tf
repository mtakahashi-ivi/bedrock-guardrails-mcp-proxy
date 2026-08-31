provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "bedrock-guardrails-mcp-proxy"
      ManagedBy = "Terraform"
    }
  }
}
