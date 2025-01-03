# Development environment identifier
environment = "development"

# AWS region for development deployment
aws_region = "us-east-1"

# Development VPC CIDR block
vpc_cidr = "10.0.0.0/16"

# Reduced availability zones for development environment
availability_zones = [
  "us-east-1a",
  "us-east-1b"
]

# Development-grade ECS instance type optimized for cost
ecs_instance_type = "t3.large"

# Minimal capacity settings for development workloads
min_capacity = 1
max_capacity = 4

# Cost-effective database instance for development
db_instance_class = "db.t3.large"

# Reduced backup retention for development environment
backup_retention_days = 7

# Maintain encryption even in development for security consistency
enable_encryption = true

# Development environment specific tags
tags = {
  Project         = "AI-Application-Intake"
  Environment     = "development"
  ManagedBy       = "terraform"
  Team            = "Platform"
  CostCenter      = "Development"
  AutoShutdown    = "true"
  EnvironmentType = "non-production"
}

# Development monitoring settings
monitoring_retention_days = 30

# Development alert endpoints
alert_email_endpoints = [
  "platform-dev-alerts@dollarfunding.com"
]