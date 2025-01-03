# AWS Provider configuration for staging environment
# Version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "terraform-state-ai-application-intake"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# Provider configuration with enhanced retry and monitoring settings
provider "aws" {
  region = local.region
  
  default_tags {
    tags = local.tags
  }

  retry_mode = "adaptive"
  max_retries = 10
}

# Local variables for resource configuration
locals {
  environment = "staging"
  region     = "us-east-1"
  az_count   = 3
  
  tags = {
    Environment     = "staging"
    Project         = "ai-application-intake"
    ManagedBy       = "terraform"
    CostCenter      = "staging-ops"
    BackupPolicy    = "daily"
    MonitoringLevel = "enhanced"
  }
}

# Networking module for VPC and subnet configuration
module "networking" {
  source = "../../modules/networking"

  environment = local.environment
  vpc_cidr    = "10.1.0.0/16"  # Staging VPC CIDR
  az_count    = local.az_count

  enable_nat_gateway = true
  enable_vpn_gateway = false

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  tags = local.tags
}

# Security module for IAM, KMS, and WAF configuration
module "security" {
  source = "../../modules/security"

  environment            = local.environment
  vpc_id                = module.networking.vpc_id
  kms_key_deletion_window = 30
  enable_key_rotation    = true

  waf_rate_limit = {
    staging = 5000
  }

  security_group_rules = {
    api = {
      type        = "ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  waf_block_rules = {
    ip_rate_based = true
    sql_injection = true
    xss           = true
    bad_bots      = true
  }

  tags = local.tags
}

# Database module for RDS and ElastiCache configuration
module "database" {
  source = "../../modules/database"

  environment = local.environment
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids

  db_instance_class         = "db.r6g.xlarge"
  db_engine_version        = "15.0"
  db_allocated_storage     = 100
  db_max_allocated_storage = 1000
  db_backup_retention_period = 7
  db_multi_az             = true
  db_replica_count        = 2

  redis_node_type            = "cache.r6g.large"
  redis_num_cache_nodes     = 2
  redis_parameter_group_family = "redis7"

  enable_encryption = true

  tags = local.tags
}

# Storage module for S3 configuration
module "storage" {
  source = "../../modules/storage"

  environment    = local.environment
  bucket_name    = "staging-ai-application-intake-docs"
  
  enable_versioning = true
  enable_encryption = true
  kms_key_arn      = module.security.kms_key_arn
  enable_mfa_delete = true

  lifecycle_rules = {
    documents = {
      transition_ia_days      = 30
      transition_glacier_days = 90
      expiration_days        = 2555  # 7 years retention
      prefix                 = "documents/"
    }
    temp = {
      transition_ia_days      = 7
      transition_glacier_days = 30
      expiration_days        = 90
      prefix                 = "temp/"
    }
  }

  tags = local.tags
}

# Compute module for ECS configuration
module "compute" {
  source = "../../modules/compute"

  environment = local.environment
  cluster_name = "ai-application-intake-staging"
  enable_container_insights = true

  task_configurations = {
    api_gateway = {
      cpu                      = 2048
      memory                   = 4096
      desired_count           = 3
      min_capacity            = 3
      max_capacity            = 10
      scaling_cpu_threshold    = 70
      scaling_memory_threshold = 80
      health_check_grace_period = 60
      deregistration_delay     = 30
    }
    document_processor = {
      cpu                      = 4096
      memory                   = 8192
      desired_count           = 4
      min_capacity            = 4
      max_capacity            = 15
      scaling_cpu_threshold    = 65
      scaling_memory_threshold = 75
      health_check_grace_period = 120
      deregistration_delay     = 60
    }
  }

  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.security.security_group_id
  service_role_arn   = module.security.service_role_arn
  kms_key_arn        = module.security.kms_key_arn

  tags = local.tags
}

# Outputs for cross-stack reference
output "vpc_id" {
  value = module.networking.vpc_id
  description = "VPC ID for the staging environment"
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
  description = "Private subnet IDs for the staging environment"
}

output "database_endpoint" {
  value = module.database.db_endpoint
  description = "RDS database endpoint"
  sensitive = true
}

output "redis_endpoint" {
  value = module.database.redis_endpoint
  description = "Redis cache endpoint"
  sensitive = true
}

output "document_bucket" {
  value = module.storage.bucket_id
  description = "S3 bucket for document storage"
}

output "ecs_cluster_name" {
  value = module.compute.cluster_name
  description = "ECS cluster name"
}