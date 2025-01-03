# Terraform variable definitions for security module configuration

# Environment variable with validation
variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
  
  validation {
    condition     = can(regex("^(development|staging|production)$", var.environment))
    error_message = "Environment must be development, staging, or production."
  }
}

# VPC ID variable with validation
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where security groups will be created"
  
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid and start with 'vpc-'."
  }
}

# KMS key deletion window variable with validation
variable "kms_key_deletion_window" {
  type        = number
  description = "Waiting period before KMS key deletion"
  default     = 30
  
  validation {
    condition     = var.kms_key_deletion_window >= 7 && var.kms_key_deletion_window <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days."
  }
}

# KMS key rotation variable
variable "enable_key_rotation" {
  type        = bool
  description = "Enable automatic KMS key rotation"
  default     = true
}

# WAF rate limit rules per environment
variable "waf_rate_limit" {
  type        = map(number)
  description = "WAF rate limit rules per environment"
  default = {
    development = 2000
    staging     = 5000
    production  = 10000
  }
}

# Allowed IP ranges for security groups
variable "allowed_ip_ranges" {
  type        = list(string)
  description = "List of allowed IP CIDR ranges for security group rules"
  default     = []
  
  validation {
    condition = alltrue([
      for ip in var.allowed_ip_ranges : can(cidrhost(ip, 0))
    ])
    error_message = "All IP ranges must be valid CIDR blocks."
  }
}

# Resource tags for security components
variable "tags" {
  type        = map(string)
  description = "Resource tags for security components"
  default     = {}
}

# IAM role variables
variable "iam_role_prefix" {
  type        = string
  description = "Prefix for IAM role names"
  default     = "app"
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-_]{0,31}$", var.iam_role_prefix))
    error_message = "IAM role prefix must start with a letter and contain only alphanumeric characters, hyphens, or underscores."
  }
}

# Security group variables
variable "security_group_rules" {
  type = map(object({
    type        = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
  }))
  description = "Map of security group rules"
  default     = {}
  
  validation {
    condition = alltrue([
      for rule in var.security_group_rules : contains(["ingress", "egress"], rule.type)
    ])
    error_message = "Security group rule type must be either 'ingress' or 'egress'."
  }
}

# WAF configuration variables
variable "waf_block_rules" {
  type = object({
    ip_rate_based = bool
    sql_injection = bool
    xss           = bool
    bad_bots      = bool
  })
  description = "WAF rule configurations for different protection types"
  default = {
    ip_rate_based = true
    sql_injection = true
    xss           = true
    bad_bots      = true
  }
}

# KMS key alias prefix
variable "kms_key_alias_prefix" {
  type        = string
  description = "Prefix for KMS key aliases"
  default     = "app"
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9/_-]{0,31}$", var.kms_key_alias_prefix))
    error_message = "KMS key alias prefix must start with a letter and contain only alphanumeric characters, forward slashes, hyphens, or underscores."
  }
}