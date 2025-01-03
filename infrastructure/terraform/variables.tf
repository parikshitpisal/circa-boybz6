# Core Terraform functionality for variable definitions and validation rules
# terraform ~> 1.0

# Environment name with validation for development/staging/production
variable "environment" {
  description = "Deployment environment (development/staging/production)"
  type        = string
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# AWS region with validation for supported regions
variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-3]$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

# CIDR block for VPC with validation for proper CIDR format
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# List of availability zones with validation for minimum count
variable "availability_zones" {
  description = "List of availability zones for high availability"
  type        = list(string)
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }
}

# EC2 instance type for ECS tasks with validation for allowed types
variable "ecs_instance_type" {
  description = "EC2 instance type for ECS tasks"
  type        = string
  
  validation {
    condition     = can(regex("^(t3|c6i|r6g)\\.(micro|small|medium|large|xlarge|2xlarge)$", var.ecs_instance_type))
    error_message = "ECS instance type must be a valid and supported instance type."
  }
}

# Minimum number of ECS tasks with validation for non-zero value
variable "min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 2
  
  validation {
    condition     = var.min_capacity > 0
    error_message = "Minimum capacity must be greater than 0."
  }
}

# Maximum number of ECS tasks with validation for minimum threshold
variable "max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
  
  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity."
  }
}

# RDS instance type with validation for allowed instance classes
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  
  validation {
    condition     = can(regex("^db\\.(t3|r6g|m6g)\\.(micro|small|medium|large|xlarge|2xlarge)$", var.db_instance_class))
    error_message = "DB instance class must be a valid and supported instance type."
  }
}

# Number of days to retain database backups with validation for minimum retention
variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
  
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention period must be at least 7 days."
  }
}

# Enable encryption for storage resources with production enforcement
variable "enable_encryption" {
  description = "Enable encryption for storage resources"
  type        = bool
  default     = true
  
  validation {
    condition     = var.environment != "production" || var.enable_encryption
    error_message = "Encryption must be enabled in production environment."
  }
}

# Common tags for all resources with required tag validation
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  
  validation {
    condition     = contains(keys(var.tags), "Project") && contains(keys(var.tags), "Environment")
    error_message = "Tags must include 'Project' and 'Environment' keys."
  }
}

# CloudWatch logs retention period with compliance validation
variable "monitoring_retention_days" {
  description = "CloudWatch logs retention period in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.monitoring_retention_days >= 30
    error_message = "Monitoring logs must be retained for at least 30 days."
  }
}

# Email endpoints for monitoring alerts with format validation
variable "alert_email_endpoints" {
  description = "Email endpoints for monitoring alerts"
  type        = list(string)
  
  validation {
    condition     = length([for email in var.alert_email_endpoints : email if can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", email))]) == length(var.alert_email_endpoints)
    error_message = "All alert email endpoints must be valid email addresses."
  }
}