# AWS Provider configuration for compute infrastructure
# Version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# ECS Cluster with enhanced monitoring and capacity management
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 1
    base             = 1
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.cluster_name}-${var.environment}"
      Environment = var.environment
    }
  )
}

# ECS Task Definitions for each service
resource "aws_ecs_task_definition" "services" {
  for_each = var.task_configurations

  family                   = "${each.key}-${var.environment}"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.service_role_arn
  task_role_arn           = var.service_role_arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/${each.key}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "/health"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.environment}/${each.key}"
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]

      secrets = [
        {
          name      = "APP_SECRETS"
          valueFrom = "${var.kms_key_arn}:app-secrets::"
        }
      ]
    }
  ])

  tags = merge(
    var.tags,
    {
      Name        = "${each.key}-${var.environment}"
      Environment = var.environment
      Service     = each.key
    }
  )
}

# ECS Services with enhanced deployment and discovery
resource "aws_ecs_service" "services" {
  for_each = var.task_configurations

  name                              = "${each.key}-${var.environment}"
  cluster                          = aws_ecs_cluster.main.id
  task_definition                  = aws_ecs_task_definition.services[each.key].arn
  desired_count                    = each.value.desired_count
  launch_type                      = "FARGATE"
  platform_version                 = "LATEST"
  health_check_grace_period_seconds = each.value.health_check_grace_period

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_configuration {
    deployment_maximum_percent         = 200
    deployment_minimum_healthy_percent = 100
  }

  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  tags = merge(
    var.tags,
    {
      Name        = "${each.key}-${var.environment}"
      Environment = var.environment
      Service     = each.key
    }
  )
}

# Service Discovery for ECS services
resource "aws_service_discovery_service" "services" {
  for_each = var.task_configurations

  name = "${each.key}-${var.environment}"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# Private DNS namespace for service discovery
resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "internal.${var.environment}.local"
  vpc  = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name        = "service-discovery-${var.environment}"
      Environment = var.environment
    }
  )
}

# Auto Scaling for ECS services
resource "aws_appautoscaling_target" "services" {
  for_each = var.task_configurations

  max_capacity       = each.value.max_capacity
  min_capacity       = each.value.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.services[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU-based Auto Scaling
resource "aws_appautoscaling_policy" "cpu" {
  for_each = var.task_configurations

  name               = "${each.key}-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = each.value.scaling_cpu_threshold
  }
}

# Memory-based Auto Scaling
resource "aws_appautoscaling_policy" "memory" {
  for_each = var.task_configurations

  name               = "${each.key}-memory-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = each.value.scaling_memory_threshold
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}