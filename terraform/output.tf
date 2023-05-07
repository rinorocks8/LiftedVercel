resource "random_uuid" "test" {
}

locals {
  file_contents = file("${path.module}/../vercel/raw.env")
}

resource "local_sensitive_file" "env_file" {
  content = join("\n", [
    for table_name, table_name_env_var in local.table_names :
    "${table_name}=${table_name_env_var}"
  ], ["userPoolID=${aws_cognito_user_pool.lifted.id}", "AWS_REGION=${var.aws_region}", "API_KEY=${random_uuid.test.result}", local.file_contents])
  filename = "${path.module}/../vercel/.env"
}

resource "null_resource" "generate_graphql" {
  provisioner "local-exec" {
    command     = "npx graphql-codegen"
    working_dir = "../vercel"
  }

  triggers = {
    always_run = timestamp()
  }
}
