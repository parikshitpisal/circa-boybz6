# Backend configuration for AI-Driven Application Intake Platform
# AWS Provider Version: ~> 5.0
# Terraform Version: >= 1.0.0

terraform {
  # S3 backend configuration with enhanced security and state management
  backend "s3" {
    # Primary state storage bucket with environment-based organization
    bucket = "ai-application-intake-terraform-state"
    
    # Dynamic state file path based on workspace environment
    key = "terraform.tfstate"
    
    # Primary region for state storage
    region = "us-east-1"
    
    # Enable state file encryption at rest using AES256
    encrypt = true
    
    # DynamoDB table for state locking and consistency
    dynamodb_table = "terraform-state-lock"
    
    # Workspace-based state organization
    workspace_key_prefix = "workspaces"
    
    # Enhanced S3 bucket configurations
    acl                  = "private"
    force_path_style     = false
    
    # State file versioning for backup and recovery
    versioning = true
    
    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }
    
    # Access logging configuration
    logging {
      target_bucket = "ai-application-intake-terraform-logs"
      target_prefix = "state-access-logs/"
    }
    
    # VPC endpoint configuration for enhanced security
    endpoint = "s3.us-east-1.amazonaws.com"
    
    # Lifecycle rules for state file management
    lifecycle_rule {
      enabled = true
      
      # Transition noncurrent versions to STANDARD_IA after 30 days
      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }
      
      # Expire noncurrent versions after 90 days
      noncurrent_version_expiration {
        days = 90
      }
    }
    
    # State locking configuration
    dynamodb_table_tags = {
      Name        = "terraform-state-lock"
      Environment = "shared"
      Purpose     = "state-locking"
    }
    
    # Additional security configurations
    kms_key_id = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/terraform-state-key"
    
    # Retry configuration for state operations
    skip_credentials_validation = false
    skip_region_validation     = false
    skip_metadata_api_check    = false
    
    # Enable CloudTrail logging for state access
    enable_cloudtrail = true
  }
  
  # Required provider versions
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # Minimum required Terraform version
  required_version = ">= 1.0.0"
}