resource "random_uuid" "test" {
}

resource "local_file" "env_file" {
  content = join("\n", [
    for table_name, table_name_env_var in local.table_names :
    "${table_name}=${table_name_env_var}"
  ], ["userPoolID=${aws_cognito_user_pool.lifted.id}", "API_KEY=${random_uuid.test.result}"])
  filename = "${path.module}/../vercel/.env"
}
