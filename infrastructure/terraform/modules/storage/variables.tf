# Environment variable with strict validation
variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production) with strict validation"

  validation {
    condition     = can(regex("^(development|staging|production)$", var.environment))
    error_message = "Environment must be development, staging, or production"
  }
}

# S3 bucket name with AWS naming convention validation
variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket for document storage with AWS naming convention validation"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens and dots, start/end with alphanumeric"
  }
}

# Versioning configuration
variable "enable_versioning" {
  type        = bool
  description = "Enable versioning for the S3 bucket for document version control and recovery"
  default     = true
}

# Server-side encryption configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable AES-256-GCM server-side encryption for the S3 bucket"
  default     = true
}

# KMS key configuration for enhanced encryption
variable "kms_key_arn" {
  type        = string
  description = "ARN of KMS key for enhanced encryption (optional)"
  default     = null
}

# Lifecycle rules for tiered storage configuration
variable "lifecycle_rules" {
  type = map(object({
    transition_ia_days      = number
    transition_glacier_days = number
    expiration_days        = number
    prefix                 = string
  }))
  description = "Lifecycle rules for tiered storage transitions with prefix support"
  default = {
    default_rule = {
      transition_ia_days      = 90
      transition_glacier_days = 365
      expiration_days        = 2555  # 7 years retention
      prefix                 = ""
    }
  }

  validation {
    condition     = alltrue([for rule in var.lifecycle_rules : rule.transition_ia_days < rule.transition_glacier_days])
    error_message = "Transition to IA must occur before transition to Glacier for all rules"
  }

  validation {
    condition     = alltrue([for rule in var.lifecycle_rules : rule.expiration_days > rule.transition_glacier_days])
    error_message = "Expiration must occur after Glacier transition for all rules"
  }
}

# MFA delete protection configuration
variable "enable_mfa_delete" {
  type        = bool
  description = "Enable MFA delete protection for critical environments"
  default     = false
}

# Public access block configuration
variable "block_public_access" {
  type        = bool
  description = "Enable S3 block public access settings"
  default     = true
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all storage resources for organization and cost tracking"
  default     = {}

  validation {
    condition     = length(var.tags) <= 50
    error_message = "Maximum of 50 tags can be specified"
  }

  validation {
    condition     = alltrue([for k, v in var.tags : length(k) <= 128 && length(v) <= 256])
    error_message = "Tag keys must be <= 128 chars and values <= 256 chars"
  }
}