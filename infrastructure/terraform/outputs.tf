# Output definitions for root Terraform configuration
# Version: ~> 1.0

# Environment information outputs
output "environment_info" {
  description = "Environment-specific infrastructure information including region and deployment stage"
  value = {
    environment         = var.environment
    region             = data.aws_region.current.name
    availability_zones = module.networking.availability_zones
    vpc_id             = module.networking.vpc_id
    vpc_cidr_block     = module.networking.vpc_cidr_block
  }
}

# Network infrastructure outputs
output "network_info" {
  description = "Network infrastructure details including VPC, subnets, and routing information"
  value = {
    vpc_id             = module.networking.vpc_id
    private_subnet_ids = module.networking.private_subnet_ids
    public_subnet_ids  = module.networking.public_subnet_ids
    nat_gateway_ips    = module.networking.nat_gateway_ips
    route_tables       = module.networking.route_table_ids
    flow_logs         = module.networking.flow_logs_config
  }
}

# Compute resource outputs
output "compute_info" {
  description = "Compute resource information including ECS cluster and service details"
  value = {
    cluster_arn        = module.compute.cluster_arn
    service_endpoints  = module.compute.service_endpoints
    autoscaling_groups = module.compute.autoscaling_groups
  }
  sensitive = false
}

# Database connection outputs
output "database_info" {
  description = "Database connection information including endpoints and replica details"
  value = {
    primary_endpoint   = module.database.endpoint
    replica_endpoints  = module.database.replica_endpoints
    connection_string  = module.database.connection_string
  }
  sensitive = true
}

# Storage resource outputs
output "storage_info" {
  description = "Storage resource information including S3 buckets and access points"
  value = {
    document_bucket = {
      name = module.storage.bucket_name
      arn  = module.storage.bucket_arn
    }
    access_points = module.storage.access_points
  }
}

# Security configuration outputs
output "security_info" {
  description = "Security configuration information including IAM roles, security groups, and WAF details"
  value = {
    security_groups = module.security.security_group_id
    iam_roles = {
      service_role_arn  = module.security.service_role_arn
      service_role_name = module.security.service_role_name
    }
    waf_config = {
      web_acl_id  = module.security.waf_web_acl_id
      web_acl_arn = module.security.waf_web_acl_arn
    }
    kms_keys = {
      app_encryption_key_id  = module.security.kms_key_id
      app_encryption_key_arn = module.security.kms_key_arn
    }
  }
  sensitive = true
}

# Monitoring and observability outputs
output "monitoring_info" {
  description = "Monitoring and observability configuration including log groups and metrics"
  value = {
    vpc_flow_logs = module.networking.flow_logs_config
    log_groups = {
      application = "/aws/application/${var.environment}"
      ecs        = "/aws/ecs/${var.environment}"
      vpc        = module.networking.flow_logs_config.log_group_name
    }
    metrics_namespace = "AI-Application-Intake/${var.environment}"
  }
}

# High availability configuration outputs
output "ha_config" {
  description = "High availability configuration details for the 99.9% uptime requirement"
  value = {
    availability_zones = module.networking.availability_zones
    multi_az_enabled  = length(module.networking.availability_zones) >= 2
    failover_enabled  = true
    backup_retention  = var.environment == "production" ? 30 : 7
  }
}

# Application endpoints outputs
output "application_endpoints" {
  description = "Application service endpoints for external integrations"
  value = {
    api_gateway     = module.compute.service_endpoints["api_gateway"]
    document_processor = module.compute.service_endpoints["document_processor"]
    email_service    = module.compute.service_endpoints["email_service"]
  }
  sensitive = false
}