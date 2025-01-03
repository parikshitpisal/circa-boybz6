# Output definitions for security module resources

# KMS key outputs
output "kms_key_id" {
  value       = aws_kms_key.app_encryption.id
  description = "The ID of the KMS key used for application data encryption"
  sensitive   = true
}

output "kms_key_arn" {
  value       = aws_kms_key.app_encryption.arn
  description = "The ARN of the KMS key used for application data encryption"
  sensitive   = true
}

# IAM role outputs
output "service_role_arn" {
  value       = aws_iam_role.service_role.arn
  description = "The ARN of the IAM role used for service authentication"
  sensitive   = true
}

output "service_role_name" {
  value       = aws_iam_role.service_role.name
  description = "The name of the IAM role used for service authentication"
}

# Security group outputs
output "security_group_id" {
  value       = aws_security_group.app_security.id
  description = "The ID of the security group used for application network access control"
}

# WAF Web ACL outputs
output "waf_web_acl_id" {
  value       = aws_wafv2_web_acl.app_waf.id
  description = "The ID of the WAF Web ACL used for application protection"
}

output "waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.app_waf.arn
  description = "The ARN of the WAF Web ACL used for application protection"
  sensitive   = true
}