# Development environment Terraform configuration for AI-Driven Application Intake Platform
# terraform ~> 1.5

# Configure Terraform settings and AWS provider
terraform {
  required_version = ">= 1.5.0"

  # Configure S3 backend for state management
  backend "s3" {
    bucket         = "ai-application-intake-tfstate-dev"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-dev"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure AWS provider for development environment
provider "aws" {
  region = "us-east-1"

  default_tags {
    Environment     = "development"
    Project         = "AI-Application-Intake"
    ManagedBy       = "Terraform"
    SecurityLevel   = "standard"
    CostCenter      = "Development"
    AutoShutdown    = "true"
  }
}

# Instantiate root module with development-specific configurations
module "root" {
  source = "../../"

  # Environment configuration
  environment = "development"
  region      = "us-east-1"
  vpc_cidr    = "10.0.0.0/16"
  
  # High availability configuration (minimal for dev)
  availability_zones = ["us-east-1a", "us-east-1b"]
  
  # Database configuration (cost-optimized for dev)
  db_instance_class = "db.t3.large"
  
  # Compute configuration (minimal for dev)
  ecs_instance_type = "t3.large"
  min_capacity      = 1
  max_capacity      = 2
  
  # Security configuration
  enable_encryption = true
  
  # Backup configuration (minimal for dev)
  backup_retention_days = 7
  
  # Cache configuration (minimal for dev)
  redis_node_type      = "cache.t3.medium"
  redis_num_cache_nodes = 1
  
  # Monitoring configuration
  enable_monitoring    = true
  log_retention_days   = 30
  
  # Resource tagging
  tags = {
    Environment   = "development"
    Project       = "AI-Application-Intake"
    ManagedBy     = "Terraform"
    CostCenter    = "Development"
    AutoShutdown  = "true"
  }
}

# Output important resource identifiers
output "vpc_id" {
  description = "VPC identifier for development environment networking"
  value       = module.root.vpc_id
}

output "database_endpoint" {
  description = "RDS endpoint for development environment database access"
  value       = module.root.database_endpoint
  sensitive   = true
}

output "storage_bucket" {
  description = "S3 bucket name for development environment document storage"
  value       = module.root.storage_bucket
}

output "ecs_cluster_name" {
  description = "ECS cluster name for development environment container orchestration"
  value       = module.root.ecs_cluster_name
}