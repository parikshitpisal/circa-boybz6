# AWS Provider and Random provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  db_identifier        = "${var.environment}-postgres-db"
  redis_identifier     = "${var.environment}-redis-cache"
  monitoring_role_name = "${var.environment}-rds-monitoring-role"
  backup_window        = "03:00-04:00"
  maintenance_window   = "Mon:04:00-Mon:05:00"
  
  common_tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Service     = "application-intake"
  })
}

# Generate secure random password for RDS master user
resource "random_password" "master" {
  length           = 32
  special          = true
  min_special      = 2
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  override_special = "!#$%^&*()-_=+[]{}:?"
}

# AWS Secrets Manager secret for database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${local.db_identifier}-credentials"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "dbadmin"
    password = random_password.master.result
  })
}

# Security group for PostgreSQL RDS
resource "aws_security_group" "postgresql" {
  name_prefix = "${local.db_identifier}-sg"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = []  # To be populated with application security group IDs
  }

  tags = merge(local.common_tags, {
    Name = "${local.db_identifier}-sg"
  })
}

# Security group for Redis cache
resource "aws_security_group" "redis" {
  name_prefix = "${local.redis_identifier}-sg"
  vpc_id      = var.vpc_id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = []  # To be populated with application security group IDs
  }

  tags = merge(local.common_tags, {
    Name = "${local.redis_identifier}-sg"
  })
}

# RDS Parameter Group
resource "aws_db_parameter_group" "postgresql" {
  family = "postgres15"
  name   = "${local.db_identifier}-params"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  tags = local.common_tags
}

# RDS Option Group
resource "aws_db_option_group" "postgresql" {
  engine_name              = "postgres"
  major_engine_version     = "15"
  name                     = "${local.db_identifier}-options"
  
  tags = local.common_tags
}

# Primary PostgreSQL RDS instance
resource "aws_db_instance" "primary" {
  identifier     = local.db_identifier
  instance_class = var.db_instance_class
  engine         = "postgres"
  engine_version = var.db_engine_version

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true

  username = jsondecode(aws_secretsmanager_secret_version.db_credentials.secret_string)["username"]
  password = jsondecode(aws_secretsmanager_secret_version.db_credentials.secret_string)["password"]

  multi_az               = var.db_multi_az
  db_subnet_group_name   = var.database_subnet_group
  vpc_security_group_ids = [aws_security_group.postgresql.id]
  parameter_group_name   = aws_db_parameter_group.postgresql.name
  option_group_name      = aws_db_option_group.postgresql.name

  backup_retention_period = var.db_backup_retention_period
  backup_window          = local.backup_window
  maintenance_window     = local.maintenance_window

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${local.db_identifier}-final-snapshot"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = local.common_tags
}

# Read replicas
resource "aws_db_instance" "replica" {
  count               = var.db_replica_count
  identifier          = "${local.db_identifier}-replica-${count.index + 1}"
  instance_class      = var.db_instance_class
  replicate_source_db = aws_db_instance.primary.identifier

  multi_az               = false
  vpc_security_group_ids = [aws_security_group.postgresql.id]

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true
  backup_retention_period   = 0

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn

  tags = merge(local.common_tags, {
    Name = "${local.db_identifier}-replica-${count.index + 1}"
  })
}

# Redis parameter group
resource "aws_elasticache_parameter_group" "redis" {
  family = var.redis_parameter_group_family
  name   = "${local.redis_identifier}-params"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = local.common_tags
}

# Redis subnet group
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.redis_identifier}-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = local.common_tags
}

# Redis replication group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = local.redis_identifier
  replication_group_description = "Redis cache cluster for application intake platform"
  node_type                     = var.redis_node_type
  number_cache_clusters         = var.redis_num_cache_nodes
  port                         = 6379

  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  maintenance_window = local.maintenance_window
  snapshot_window   = local.backup_window
  
  snapshot_retention_limit = 7

  tags = local.common_tags
}

# IAM role for RDS monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = local.monitoring_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}