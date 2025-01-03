# Core Terraform functionality for variable definitions
# Version: ~> 1.0

# Environment deployment configuration
variable "environment" {
  description = "Deployment environment (development, staging, production)"
  type        = string

  validation {
    condition     = can(regex("^(development|staging|production)$", var.environment))
    error_message = "Environment must be development, staging, or production"
  }
}

# ECS cluster name configuration
variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "ai-application-intake"
}

# CloudWatch Container Insights configuration
variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for monitoring"
  type        = bool
  default     = true
}

# Comprehensive task configurations for all services
variable "task_configurations" {
  description = "Comprehensive map of service names to their task configurations including scaling and monitoring settings"
  type = map(object({
    cpu                      = number
    memory                   = number
    desired_count           = number
    min_capacity            = number
    max_capacity            = number
    scaling_cpu_threshold    = number
    scaling_memory_threshold = number
    health_check_grace_period = number
    deregistration_delay     = number
  }))

  default = {
    api_gateway = {
      cpu                      = 2048  # 2 vCPU
      memory                   = 4096  # 4GB
      desired_count           = 3
      min_capacity            = 3
      max_capacity            = 10
      scaling_cpu_threshold    = 70
      scaling_memory_threshold = 80
      health_check_grace_period = 60
      deregistration_delay     = 30
    }
    document_processor = {
      cpu                      = 4096  # 4 vCPU
      memory                   = 8192  # 8GB
      desired_count           = 4
      min_capacity            = 4
      max_capacity            = 15
      scaling_cpu_threshold    = 65
      scaling_memory_threshold = 75
      health_check_grace_period = 120
      deregistration_delay     = 60
    }
    email_service = {
      cpu                      = 2048  # 2 vCPU
      memory                   = 4096  # 4GB
      desired_count           = 2
      min_capacity            = 2
      max_capacity            = 8
      scaling_cpu_threshold    = 60
      scaling_memory_threshold = 70
      health_check_grace_period = 90
      deregistration_delay     = 45
    }
  }

  validation {
    condition     = alltrue([for k, v in var.task_configurations : 
                    v.cpu >= 256 && v.cpu <= 16384 && 
                    v.memory >= 512 && v.memory <= 32768 &&
                    v.desired_count >= v.min_capacity &&
                    v.desired_count <= v.max_capacity &&
                    v.scaling_cpu_threshold >= 0 && v.scaling_cpu_threshold <= 100 &&
                    v.scaling_memory_threshold >= 0 && v.scaling_memory_threshold <= 100])
    error_message = "Invalid task configuration values. Please check CPU, memory, capacity, and threshold ranges."
  }
}

# Resource tagging configuration
variable "tags" {
  description = "Resource tags for cost tracking and organization"
  type        = map(string)
  default = {
    Project    = "AI-Application-Intake"
    ManagedBy  = "Terraform"
  }

  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified for resource organization"
  }
}