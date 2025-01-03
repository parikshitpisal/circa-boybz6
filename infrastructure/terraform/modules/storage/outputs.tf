# Output definitions for the S3 storage module
# Exposes bucket attributes and configuration status for integration with other services

output "bucket_id" {
  description = "The ID of the S3 bucket used for document storage"
  value       = aws_s3_bucket.document_storage.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket for IAM policy configuration"
  value       = aws_s3_bucket.document_storage.arn
}

output "bucket_domain_name" {
  description = "The domain name of the S3 bucket for direct access configuration"
  value       = aws_s3_bucket.document_storage.bucket_domain_name
}

output "bucket_region" {
  description = "The AWS region where the S3 bucket is located for cross-region replication setup"
  value       = aws_s3_bucket.document_storage.region
}

output "bucket_versioning_enabled" {
  description = "Boolean indicating whether versioning is enabled for the S3 bucket"
  value       = aws_s3_bucket_versioning.document_storage.versioning_configuration[0].status == "Enabled"
}

output "bucket_encryption_enabled" {
  description = "Boolean indicating whether server-side encryption is enabled for the S3 bucket"
  value       = aws_s3_bucket_server_side_encryption_configuration.document_storage.rule[0].apply_server_side_encryption_by_default.sse_algorithm != null
}

output "bucket_lifecycle_rules" {
  description = "List of lifecycle rules applied to the bucket for data retention and archival"
  value       = aws_s3_bucket_lifecycle_configuration.document_storage.rule
}

output "bucket_logging_enabled" {
  description = "Boolean indicating whether access logging is enabled for the S3 bucket"
  value       = aws_s3_bucket_logging.document_storage.target_bucket != null
}

output "bucket_public_access_blocked" {
  description = "Boolean indicating whether public access is fully blocked for the S3 bucket"
  value       = aws_s3_bucket_public_access_block.document_storage.block_public_acls && 
                aws_s3_bucket_public_access_block.document_storage.block_public_policy &&
                aws_s3_bucket_public_access_block.document_storage.ignore_public_acls &&
                aws_s3_bucket_public_access_block.document_storage.restrict_public_buckets
}

output "bucket_mfa_delete_enabled" {
  description = "Boolean indicating whether MFA delete protection is enabled for the S3 bucket"
  value       = aws_s3_bucket_versioning.document_storage.versioning_configuration[0].mfa_delete == "Enabled"
}

output "bucket_ssl_enforced" {
  description = "Boolean indicating whether SSL/TLS is enforced for all bucket operations"
  value       = true # Always true due to enforced bucket policy
}