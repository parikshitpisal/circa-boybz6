# Production Environment Configuration
# Terraform >= 1.0

# Core Environment Settings
environment = "production"
aws_region = "us-east-1"
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# ECS Task Configurations for Different Services
task_configurations = {
  # API Gateway Service Configuration
  api_gateway = {
    cpu = 2048           # 2 vCPU
    memory = 4096        # 4GB RAM
    desired_count = 4    # Base capacity
    min_capacity = 4     # Minimum instances for HA
    max_capacity = 10    # Maximum scaling limit
  }

  # Document Processing Service Configuration
  document_processor = {
    cpu = 4096           # 4 vCPU
    memory = 8192        # 8GB RAM
    desired_count = 6    # Higher base capacity for processing
    min_capacity = 6     # Minimum instances for heavy workloads
    max_capacity = 15    # Scale up for peak processing
  }

  # Email Service Configuration
  email_service = {
    cpu = 2048           # 2 vCPU
    memory = 4096        # 4GB RAM
    desired_count = 4    # Base capacity
    min_capacity = 4     # Minimum instances for HA
    max_capacity = 8     # Maximum scaling limit
  }
}

# Database Configuration for Production
database_configuration = {
  db_multi_az = true                 # Enable Multi-AZ for HA
  db_replica_count = 2               # Read replicas for scaling
  db_allocated_storage = 500         # Initial storage in GB
  db_max_allocated_storage = 2000    # Max storage in GB
  db_backup_retention_period = 30    # 30 days retention
  db_engine_version = "15.0"         # PostgreSQL version
}

# Redis Cache Configuration
redis_configuration = {
  node_type = "cache.r6g.large"      # Production-grade instance
  num_cache_nodes = 4                # Multiple nodes for HA
  parameter_group_family = "redis7"   # Redis version
}

# Compute Resource Settings
ecs_instance_type = "c6i.2xlarge"    # Production compute optimized
min_capacity = 3                      # Minimum capacity across services
max_capacity = 15                     # Maximum capacity across services

# Database Settings
db_instance_class = "db.r6g.xlarge"  # Production memory optimized
backup_retention_days = 30            # Extended retention for production

# Security Settings
enable_encryption = true              # Mandatory encryption for production

# Resource Tagging
tags = {
  Environment = "production"
  Project = "AI-Application-Intake"
  ManagedBy = "Terraform"
  BusinessUnit = "Operations"
  CostCenter = "PROD-001"
  DataClassification = "Confidential"
  Compliance = "GLBA"
}

# Monitoring Configuration
monitoring_retention_days = 90        # Extended log retention

# Alert Configuration
alert_email_endpoints = [
  "ops-alerts@dollarfunding.com",
  "security-alerts@dollarfunding.com",
  "oncall@dollarfunding.com"
]