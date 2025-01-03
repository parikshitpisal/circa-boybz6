# Primary PostgreSQL RDS endpoint information
output "db_primary_endpoint" {
  description = "Primary PostgreSQL RDS instance endpoint for application connectivity"
  value       = aws_db_instance.primary.endpoint
  sensitive   = true
}

output "db_primary_address" {
  description = "Primary PostgreSQL RDS instance address for DNS resolution"
  value       = aws_db_instance.primary.address
  sensitive   = true
}

output "db_primary_port" {
  description = "Primary PostgreSQL RDS instance port number"
  value       = aws_db_instance.primary.port
}

# Read replica endpoints with availability zone information
output "db_replica_endpoints" {
  description = "List of PostgreSQL read replica endpoints with their availability zones"
  value = [
    for replica in aws_db_instance.replica : {
      endpoint = replica.endpoint
      az       = replica.availability_zone
    }
  ]
  sensitive = true
}

# Performance insights endpoint for monitoring
output "db_performance_insights_endpoint" {
  description = "Performance insights endpoint for PostgreSQL RDS monitoring"
  value       = aws_db_instance.primary.performance_insights_endpoint
  sensitive   = true
}

# Redis cache cluster information
output "redis_endpoint" {
  description = "Redis cache cluster configuration endpoint for application connectivity"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis cache cluster port number"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_version" {
  description = "Redis cache engine version for compatibility verification"
  value       = aws_elasticache_replication_group.redis.engine_version
}

# Redis node information
output "redis_nodes" {
  description = "List of Redis cache nodes with their endpoints"
  value = {
    for node in aws_elasticache_replication_group.redis.cache_nodes : node.id => {
      address = node.address
      port    = node.port
    }
  }
  sensitive = true
}

# Database subnet group information
output "db_subnet_group_name" {
  description = "Name of the database subnet group for RDS instances"
  value       = var.database_subnet_group
}

# Security group information
output "db_security_group_id" {
  description = "ID of the security group attached to PostgreSQL RDS instances"
  value       = aws_security_group.postgresql.id
}

output "redis_security_group_id" {
  description = "ID of the security group attached to Redis cache cluster"
  value       = aws_security_group.redis.id
}