# Core Terraform functionality for variable definitions and validation rules
# Version: ~> 1.0

# VPC CIDR block for the network space
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network space. Must be a valid IPv4 CIDR block that provides adequate address space for all subnets across multiple availability zones."
  default     = "10.0.0.0/16"

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation (e.g., 10.0.0.0/16)"
  }
}

# Number of Availability Zones for high availability
variable "az_count" {
  type        = number
  description = "Number of Availability Zones to use for high availability deployment. Must be either 2 or 3 to ensure redundancy while managing costs."
  default     = 3

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "AZ count must be either 2 or 3 for high availability requirements"
  }
}

# Environment identifier
variable "environment" {
  type        = string
  description = "Deployment environment identifier used for resource tagging and configuration. Controls environment-specific settings and must be one of the predefined values."

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

# NAT Gateway enablement flag
variable "enable_nat_gateway" {
  type        = bool
  description = "Flag to enable NAT Gateway deployment for private subnet internet access. Recommended for production environments."
  default     = true
}

# VPN Gateway enablement flag
variable "enable_vpn_gateway" {
  type        = bool
  description = "Flag to enable VPN Gateway for secure VPC connectivity with on-premises networks."
  default     = false
}

# Private subnet additional tags
variable "private_subnet_tags" {
  type        = map(string)
  description = "Additional tags to apply to private subnets for resource organization and cost allocation."
  default     = {}
}

# Public subnet additional tags
variable "public_subnet_tags" {
  type        = map(string)
  description = "Additional tags to apply to public subnets for resource organization and cost allocation."
  default     = {}
}