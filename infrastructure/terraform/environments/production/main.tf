# Production environment Terraform configuration for AI-Driven Application Intake Platform
# terraform ~> 1.0

# Import required providers
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Configure backend for state management
  backend "s3" {
    bucket         = "ai-intake-terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-prod"
  }
}

# Define production-specific local variables
locals {
  production_settings = {
    environment                 = "production"
    region                     = "us-east-1"
    multi_az                   = true
    high_availability         = true
    enable_enhanced_monitoring = true
    enable_performance_insights = true
    enable_container_insights  = true
  }

  resource_tags = {
    Environment        = "production"
    Project           = "AI-Application-Intake"
    ManagedBy         = "Terraform"
    BusinessUnit      = "Operations"
    CostCenter        = "PROD-001"
    DataClassification = "Confidential"
    ComplianceScope   = "GLBA"
    SecurityZone      = "Production"
    BackupPolicy      = "Daily"
    DRTier           = "Tier1"
  }
}

# Configure networking module with production settings
module "networking" {
  source = "../../modules/networking"

  environment            = local.production_settings.environment
  vpc_cidr              = "10.0.0.0/16"
  availability_zones    = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway    = true
  single_nat_gateway    = false
  enable_vpc_flow_logs  = true
  enable_network_firewall = true
  enable_transit_gateway = true
  enable_private_link   = true

  tags = local.resource_tags
}

# Configure compute module with production capacity
module "compute" {
  source = "../../modules/compute"

  environment              = local.production_settings.environment
  instance_type           = "c6i.2xlarge"
  min_capacity            = 3
  max_capacity            = 10
  enable_auto_scaling     = true
  enable_container_insights = true
  enable_detailed_monitoring = true
  enable_spot_instances   = false
  cpu_threshold          = 70
  memory_threshold       = 80

  depends_on = [module.networking]
  tags       = local.resource_tags
}

# Configure database module with high availability
module "database" {
  source = "../../modules/database"

  environment                      = local.production_settings.environment
  instance_class                  = "db.r6g.2xlarge"
  multi_az                        = true
  backup_retention_days           = 30
  deletion_protection             = true
  enable_performance_insights     = true
  enable_auto_minor_version_upgrade = true
  enable_iam_authentication       = true
  storage_encrypted              = true

  depends_on = [module.networking]
  tags       = local.resource_tags
}

# Configure storage module with encryption and lifecycle
module "storage" {
  source = "../../modules/storage"

  environment               = local.production_settings.environment
  enable_encryption        = true
  enable_versioning        = true
  lifecycle_rules_enabled  = true
  enable_replication       = true
  enable_object_lock      = true
  enable_access_logging   = true
  enable_intelligent_tiering = true

  depends_on = [module.networking]
  tags       = local.resource_tags
}

# Configure security module with enhanced protection
module "security" {
  source = "../../modules/security"

  environment          = local.production_settings.environment
  enable_waf          = true
  enable_shield       = true
  enable_guardduty    = true
  enable_security_hub = true
  enable_config       = true
  enable_cloudtrail   = true
  enable_kms         = true

  depends_on = [module.networking]
  tags       = local.resource_tags
}

# Export important resource identifiers
output "vpc_id" {
  description = "Production VPC identifier"
  value       = module.networking.vpc_id
}

output "database_endpoint" {
  description = "Production RDS endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "document_bucket" {
  description = "Production document storage bucket"
  value       = module.storage.bucket_name
}