# Output definitions for the networking module
# Version: ~> 1.0

# VPC ID output for resource association
output "vpc_id" {
  description = "ID of the created VPC for resource association"
  value       = aws_vpc.main.id
}

# VPC CIDR block output for network planning
output "vpc_cidr_block" {
  description = "CIDR block of the created VPC for network planning and security group rules"
  value       = aws_vpc.main.cidr_block
}

# Private subnet IDs for internal resource deployment
output "private_subnet_ids" {
  description = "List of private subnet IDs for deploying internal resources across availability zones"
  value       = aws_subnet.private[*].id
}

# Public subnet IDs for external-facing resources
output "public_subnet_ids" {
  description = "List of public subnet IDs for deploying public-facing resources across availability zones"
  value       = aws_subnet.public[*].id
}

# NAT Gateway Elastic IP addresses
output "nat_gateway_ips" {
  description = "Elastic IP addresses of NAT Gateways for monitoring and security group configuration"
  value       = aws_eip.nat[*].public_ip
}

# Availability zones used in the VPC
output "availability_zones" {
  description = "List of availability zones used for resource distribution and HA planning"
  value       = data.aws_availability_zones.available.names
}

# Route table IDs for custom routing configuration
output "route_table_ids" {
  description = "Map of route table IDs for custom routing rules and network planning"
  value = {
    public  = aws_route_table.public.id
    private = aws_route_table.private[*].id
  }
}

# VPC Flow Logs configuration details
output "flow_logs_config" {
  description = "Configuration details for VPC Flow Logs monitoring and analysis"
  value = {
    log_group_name = aws_cloudwatch_log_group.flow_logs.name
    role_arn       = aws_iam_role.flow_logs.arn
  }
}

# Internet Gateway ID for public access configuration
output "internet_gateway_id" {
  description = "ID of the Internet Gateway for public subnet internet access"
  value       = aws_internet_gateway.main.id
}