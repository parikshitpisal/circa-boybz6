# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Data source for IAM service assume role policy
data "aws_iam_policy_document" "service_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com", "ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
  }
}

# KMS key for data encryption
resource "aws_kms_key" "app_encryption" {
  description              = "KMS key for application data encryption"
  deletion_window_in_days  = var.kms_key_deletion_window
  enable_key_rotation     = true
  key_usage               = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:CallerAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Environment = var.environment
      Name        = "${var.kms_key_alias_prefix}-${var.environment}-encryption"
      ManagedBy   = "Terraform"
    }
  )
}

# KMS key alias
resource "aws_kms_alias" "app_encryption" {
  name          = "alias/${var.kms_key_alias_prefix}/${var.environment}/encryption"
  target_key_id = aws_kms_key.app_encryption.key_id
}

# IAM role for service accounts
resource "aws_iam_role" "service_role" {
  name                 = "${var.iam_role_prefix}-${var.environment}-service-role"
  assume_role_policy   = data.aws_iam_policy_document.service_assume_role.json
  max_session_duration = 3600
  force_detach_policies = true

  tags = merge(
    var.tags,
    {
      Environment = var.environment
      Name        = "${var.iam_role_prefix}-${var.environment}-service-role"
      ManagedBy   = "Terraform"
    }
  )
}

# Security group for application components
resource "aws_security_group" "app_security" {
  name        = "${var.environment}-app-security-group"
  description = "Security group for application components"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.security_group_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Environment = var.environment
      Name        = "${var.environment}-app-security-group"
      ManagedBy   = "Terraform"
    }
  )
}

# WAF Web ACL
resource "aws_wafv2_web_acl" "app_waf" {
  name        = "${var.environment}-app-waf"
  description = "WAF rules for application protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # IP rate-based rule
  dynamic "rule" {
    for_each = var.waf_block_rules.ip_rate_based ? [1] : []
    content {
      name     = "IPRateLimit"
      priority = 1

      override_action {
        none {}
      }

      statement {
        rate_based_statement {
          limit              = var.waf_rate_limit[var.environment]
          aggregate_key_type = "IP"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "${var.environment}-IPRateLimit"
        sampled_requests_enabled  = true
      }
    }
  }

  # SQL injection protection
  dynamic "rule" {
    for_each = var.waf_block_rules.sql_injection ? [1] : []
    content {
      name     = "SQLInjectionProtection"
      priority = 2

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesSQLiRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name               = "${var.environment}-SQLInjection"
        sampled_requests_enabled  = true
      }
    }
  }

  tags = merge(
    var.tags,
    {
      Environment = var.environment
      Name        = "${var.environment}-app-waf"
      ManagedBy   = "Terraform"
    }
  )

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${var.environment}-WAF-Global"
    sampled_requests_enabled  = true
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Outputs
output "kms_key_id" {
  value       = aws_kms_key.app_encryption.id
  description = "ID of the KMS key"
}

output "kms_key_arn" {
  value       = aws_kms_key.app_encryption.arn
  description = "ARN of the KMS key"
}

output "service_role_arn" {
  value       = aws_iam_role.service_role.arn
  description = "ARN of the service IAM role"
}

output "service_role_name" {
  value       = aws_iam_role.service_role.name
  description = "Name of the service IAM role"
}

output "security_group_id" {
  value       = aws_security_group.app_security.id
  description = "ID of the security group"
}

output "waf_web_acl_id" {
  value       = aws_wafv2_web_acl.app_waf.id
  description = "ID of the WAF Web ACL"
}

output "waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.app_waf.arn
  description = "ARN of the WAF Web ACL"
}