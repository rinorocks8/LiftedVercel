# main.tf

provider "aws" {
  region = var.aws_region
}

data "external" "schema" {
  program = ["node", "${path.module}/parseSchema/parse.js"]
}

module "table" {
  source    = "./modules/tables"
  for_each  = jsondecode(data.external.schema.result["types"])
  name      = each.key
  range_key = each.value.range_key
  hash_key  = each.value.hash_key
  gsi       = each.value.gsi
  app_name  = var.app_name
  env       = var.env
}

locals {
  table_names = {
    for table_name, table_config in module.table :
    table_name => table_config.name
  }
}
