# Output definitions for compute module resources
# Version: ~> 1.0

# ECS Cluster outputs
output "cluster_id" {
  description = "ID of the ECS cluster for resource association and monitoring"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "Name of the ECS cluster for operational reference and logging"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ARN of the ECS cluster for IAM policies and cross-account access"
  value       = aws_ecs_cluster.main.arn
}

# ECS Service outputs
output "service_arns" {
  description = "Map of service names to their ARNs for monitoring and automation"
  value = {
    for name, service in aws_ecs_service.services : name => service.id
  }
}

# Task Definition outputs
output "task_definition_arns" {
  description = "Map of service names to their latest task definition ARNs"
  value = {
    for name, task in aws_ecs_task_definition.services : name => task.arn
  }
}

# Auto Scaling outputs
output "autoscaling_target_arns" {
  description = "Map of service names to their auto-scaling target ARNs"
  value = {
    for name, target in aws_appautoscaling_target.services : name => target.resource_id
  }
}

# Service Status outputs
output "service_status" {
  description = "Map of service names to their current deployment status"
  value = {
    for name, service in aws_ecs_service.services : name => {
      desired_count   = service.desired_count
      running_count   = service.running_count
      pending_count   = service.pending_count
      deployment_status = service.deployment_circuit_breaker[0].enable ? "enabled" : "disabled"
    }
  }
}

# Container Insights output
output "container_insights_status" {
  description = "Status of Container Insights monitoring for the cluster"
  value       = aws_ecs_cluster.main.setting[0].value
}

# Service Discovery outputs
output "service_discovery_namespaces" {
  description = "Service discovery namespace details for internal routing"
  value = {
    id   = aws_service_discovery_private_dns_namespace.main.id
    name = aws_service_discovery_private_dns_namespace.main.name
    arn  = aws_service_discovery_private_dns_namespace.main.arn
  }
}

# Capacity Provider outputs
output "capacity_providers" {
  description = "List of capacity providers associated with the cluster"
  value       = aws_ecs_cluster.main.capacity_providers
}

# Task Definition Family outputs
output "task_definition_families" {
  description = "Map of service names to their task definition families"
  value = {
    for name, task in aws_ecs_task_definition.services : name => task.family
  }
}

# Service Health Check outputs
output "service_health_checks" {
  description = "Map of service names to their health check configurations"
  value = {
    for name, service in aws_ecs_service.services : name => {
      grace_period_seconds = service.health_check_grace_period_seconds
      deployment_circuit_breaker = service.deployment_circuit_breaker[0]
    }
  }
}