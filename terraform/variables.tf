# ----------------------------------------------------------------------
# Default AWS Region used to deploy resources
# ----------------------------------------------------------------------
variable "aws_region" {
  default = "us-east-1"
}

# ----------------------------------------------------------------------
# Application name used for naming resources
# ----------------------------------------------------------------------
variable "app_name" {
  default = "lifted-vercel"
}

# ----------------------------------------------------------------------
# Application name used for naming resources
# ----------------------------------------------------------------------
variable "env" {
  default = "dev"
}
