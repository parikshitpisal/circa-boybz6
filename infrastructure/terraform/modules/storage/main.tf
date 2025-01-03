# AWS S3 Storage Module for AI-Driven Application Intake Platform
# Version: 1.0.0
# Provider Requirements:
# - AWS Provider ~> 4.0
# - Terraform ~> 1.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Main S3 bucket for document storage with enhanced security features
resource "aws_s3_bucket" "document_storage" {
  bucket = var.bucket_name
  tags   = var.tags

  # Force destroy only allowed in non-production environments
  force_destroy = var.environment != "production"
}

# Configure bucket ownership controls
resource "aws_s3_bucket_ownership_controls" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# Configure bucket logging
resource "aws_s3_bucket_logging" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  target_bucket = aws_s3_bucket.document_storage.id
  target_prefix = "access-logs/"
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configure versioning and MFA delete
resource "aws_s3_bucket_versioning" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  versioning_configuration {
    status     = var.enable_versioning ? "Enabled" : "Disabled"
    mfa_delete = var.enable_mfa_delete ? "Enabled" : "Disabled"
  }
}

# Configure server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_id != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_id
    }
    bucket_key_enabled = true
  }
}

# Configure lifecycle rules for tiered storage
resource "aws_s3_bucket_lifecycle_configuration" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  dynamic "rule" {
    for_each = var.lifecycle_rules

    content {
      id     = "rule-${rule.key}"
      status = "Enabled"

      filter {
        prefix = rule.value.prefix
      }

      # Transition to Standard-IA
      transition {
        days          = rule.value.transition_ia_days
        storage_class = "STANDARD_IA"
      }

      # Transition to Glacier
      transition {
        days          = rule.value.transition_glacier_days
        storage_class = "GLACIER"
      }

      # Object expiration
      expiration {
        days = rule.value.expiration_days
      }

      # Cleanup incomplete multipart uploads
      abort_incomplete_multipart_upload {
        days_after_initiation = 7
      }

      # Version expiration for versioned buckets
      noncurrent_version_expiration {
        noncurrent_days = 90
      }
    }
  }
}

# Configure bucket policy for enforced SSL
resource "aws_s3_bucket_policy" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.document_storage.arn,
          "${aws_s3_bucket.document_storage.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Configure CORS for web access if needed
resource "aws_s3_bucket_cors_configuration" "document_storage" {
  bucket = aws_s3_bucket.document_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://*.dollarfunding.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}