# Terraform variable definitions for database module
# Configures PostgreSQL RDS instances and Redis cache clusters

# Environment variable to control deployment configuration
variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
  validation {
    condition     = can(regex("^(development|staging|production)$", var.environment))
    error_message = "Environment must be one of: development, staging, production"
  }
}

# Network configuration variables
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where database resources will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for database deployment across multiple AZs"
}

# PostgreSQL RDS configuration variables
variable "db_instance_class" {
  type        = string
  description = "RDS instance class for PostgreSQL database"
  default     = "db.r6g.xlarge"
}

variable "db_engine_version" {
  type        = string
  description = "PostgreSQL engine version"
  default     = "15.0"
}

variable "db_allocated_storage" {
  type        = number
  description = "Allocated storage in GB for RDS instance"
  default     = 100
}

variable "db_max_allocated_storage" {
  type        = number
  description = "Maximum storage limit in GB for RDS autoscaling"
  default     = 1000
}

variable "db_backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 7
}

variable "db_multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for high availability"
  default     = true
}

variable "db_replica_count" {
  type        = number
  description = "Number of read replicas to create"
  default     = 2
}

# Redis ElastiCache configuration variables
variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type for Redis cluster"
  default     = "cache.r6g.large"
}

variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in the Redis cluster"
  default     = 2
}

variable "redis_parameter_group_family" {
  type        = string
  description = "Redis parameter group family"
  default     = "redis7"
}

# Security configuration
variable "enable_encryption" {
  type        = bool
  description = "Enable encryption at rest using KMS"
  default     = true
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for database resources"
  default     = {}
}