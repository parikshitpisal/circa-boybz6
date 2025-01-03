# Main Terraform configuration file for AI-Driven Application Intake Platform
# terraform ~> 1.0

# Import required providers and variables
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Define common tags for resource tracking and management
locals {
  common_tags = merge(var.tags, {
    Environment   = var.environment
    ManagedBy    = "terraform"
    Project      = "ai-intake"
    SecurityLevel = var.environment == "prod" ? "high" : "standard"
    Compliance   = "GLBA"
    Service      = "application-intake"
  })
}

# Networking module for VPC and subnet configuration
module "networking" {
  source = "./modules/networking"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_flow_logs   = true
  enable_vpc_endpoints = true

  tags = local.common_tags
}

# Compute module for ECS cluster and services
module "compute" {
  source = "./modules/compute"

  environment              = var.environment
  vpc_id                  = module.networking.vpc_id
  subnet_ids              = module.networking.private_subnet_ids
  instance_type           = var.ecs_instance_type
  min_capacity            = var.min_capacity
  max_capacity            = var.max_capacity
  enable_container_insights = true
  enable_execute_command   = var.environment != "prod"

  depends_on = [module.networking]
  tags       = local.common_tags
}

# Database module for RDS infrastructure
module "database" {
  source = "./modules/database"

  environment                     = var.environment
  vpc_id                         = module.networking.vpc_id
  subnet_ids                     = module.networking.private_subnet_ids
  instance_class                 = var.db_instance_class
  backup_retention_days          = var.backup_retention_days
  enable_performance_insights    = true
  enable_auto_minor_version_upgrade = true
  enable_deletion_protection     = var.environment == "prod"
  multi_az                       = var.environment == "prod"
  storage_encrypted             = true
  monitoring_interval           = 60

  depends_on = [module.networking]
  tags       = local.common_tags
}

# Storage module for S3 and ElastiCache
module "storage" {
  source = "./modules/storage"

  environment            = var.environment
  enable_encryption     = true
  enable_versioning     = true
  enable_lifecycle_rules = true
  enable_replication    = var.environment == "prod"
  enable_access_logging = true
  force_destroy         = var.environment != "prod"
  
  lifecycle_rules = {
    transition_glacier = 90
    expiration        = 365
  }

  tags = local.common_tags
}

# Security module for KMS, WAF, and IAM
module "security" {
  source = "./modules/security"

  environment       = var.environment
  vpc_id           = module.networking.vpc_id
  enable_waf       = true
  enable_guardduty = true
  enable_config    = true
  enable_cloudtrail = true
  
  waf_rules = {
    rate_limit          = 2000
    ip_rate_limit       = 100
    geo_match_statement = ["US"]
  }

  depends_on = [module.networking]
  tags       = local.common_tags
}

# Monitoring and alerting configuration
module "monitoring" {
  source = "./modules/monitoring"

  environment            = var.environment
  retention_days        = var.monitoring_retention_days
  alert_email_endpoints = var.alert_email_endpoints
  
  alarm_thresholds = {
    cpu_utilization    = 80
    memory_utilization = 80
    error_rate        = 5
  }

  tags = local.common_tags
}

# Output important resource identifiers
output "vpc_id" {
  description = "VPC identifier for external references"
  value       = module.networking.vpc_id
}

output "database_endpoint" {
  description = "RDS endpoint for application configuration"
  value       = module.database.endpoint
  sensitive   = true
}

output "storage_bucket" {
  description = "S3 bucket name for document storage"
  value       = module.storage.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for content delivery"
  value       = module.storage.cloudfront_distribution_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name for application deployment"
  value       = module.compute.cluster_name
}