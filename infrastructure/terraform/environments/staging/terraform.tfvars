# Environment identifier for resource tagging and identification
environment = "staging"

# AWS region for resource deployment
aws_region = "us-east-1"

# CIDR block for VPC with isolation from other environments
vpc_cidr = "10.1.0.0/16"

# List of availability zones for high availability deployment
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# EC2 instance type for ECS tasks optimized for document processing
ecs_instance_type = "t3.large"

# ECS task capacity limits for auto-scaling
min_capacity = 2
max_capacity = 8

# RDS instance type for production-grade performance
db_instance_class = "db.r6g.xlarge"

# Backup retention period for disaster recovery
backup_retention_days = 14

# Enable encryption for all storage resources
enable_encryption = true

# Common tags for resource management and tracking
tags = {
  Environment         = "staging"
  Project            = "AI-Application-Intake"
  ManagedBy          = "Terraform"
  BusinessUnit       = "Operations"
  DataClassification = "Confidential"
  CostCenter         = "CC-STAGING-001"
  BackupSchedule     = "Daily"
  SecurityZone       = "PreProd"
}

# CloudWatch logs retention period (days)
monitoring_retention_days = 30

# Alert notification endpoints
alert_email_endpoints = [
  "staging-alerts@dollarfunding.com",
  "devops-staging@dollarfunding.com"
]