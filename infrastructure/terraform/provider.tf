# Configure Terraform settings and required providers
terraform {
  # Require Terraform version 1.0.0 or higher for stability and security
  required_version = ">= 1.0.0"

  # Define required providers with version constraints
  required_providers {
    # AWS provider for infrastructure deployment
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # Use latest 5.x version for stability and features
    }

    # Random provider for resource naming and unique identifiers
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"  # Use latest 3.x version for stability
    }
  }
}

# Configure AWS provider with region and default tags
provider "aws" {
  # Use region from variables.tf
  region = var.aws_region

  # Define default tags for all resources
  default_tags {
    Project             = "AI-Driven Application Intake Platform"
    ManagedBy          = "Terraform"
    Environment        = var.environment
    SecurityCompliance = "GLBA"
    DataClassification = "Sensitive"
  }
}