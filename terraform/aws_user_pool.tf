resource "aws_cognito_user_pool" "lifted" {
  name                     = "${var.app_name}-${var.env}-user-pool"
  auto_verified_attributes = ["email"]
  alias_attributes         = ["email", "preferred_username"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "email"
    required                 = true

    string_attribute_constraints {
      max_length = "2048"
      min_length = "0"
    }
  }

  username_configuration {
    case_sensitive = false
  }
}

resource "aws_cognito_user_pool_client" "lifted" {
  depends_on   = [aws_cognito_user_pool.lifted, aws_cognito_identity_provider.google]
  name         = "liftedapi"
  user_pool_id = aws_cognito_user_pool.lifted.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes = [
    "aws.cognito.signin.user.admin",
    "email",
    "openid",
    "phone",
    "profile",
  ]
  supported_identity_providers = [
    "Google",
  ]

  callback_urls = ["liftedgym://", "exp://192.168.68.67:19000"]
  logout_urls   = ["liftedgym://", "exp://192.168.68.67:19000"]

  token_validity_units {
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_client" "postman" {
  depends_on   = [aws_cognito_user_pool.lifted, aws_cognito_identity_provider.google]
  name         = "postman"
  user_pool_id = aws_cognito_user_pool.lifted.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes = [
    "aws.cognito.signin.user.admin",
    "email",
    "openid",
    "phone",
    "profile",
  ]
  supported_identity_providers = [
    "Google",
  ]

  callback_urls = ["https://oauth.pstmn.io/v1/callback"]
  logout_urls   = ["https://oauth.pstmn.io/v1/callback"]

  generate_secret = "true"

  token_validity_units {
    refresh_token = "days"
  }
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.lifted.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes              = "profile email openid"
    client_id                     = "968969018561-ojk6v30eq12duqnamafvmjkv3thpn5ke.apps.googleusercontent.com"
    client_secret                 = "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"
    token_url                     = "https://www.googleapis.com/oauth2/v4/token"
    token_request_method          = "POST"
    oidc_issuer                   = "https://accounts.google.com"
    authorize_url                 = "https://accounts.google.com/o/oauth2/v2/auth"
    attributes_url                = "https://people.googleapis.com/v1/people/me?personFields="
    attributes_url_add_attributes = "true"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}

resource "aws_cognito_user_pool_domain" "lifted" {
  user_pool_id = aws_cognito_user_pool.lifted.id
  domain       = var.app_name
}

resource "aws_iam_policy" "user_pool_exec" {
  name = "${var.app_name}-${var.env}-user_pool_exec"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListUsers"
        ]
        Effect = "Allow"
        Resource = [
          aws_cognito_user_pool.lifted.arn
        ]
      },
    ]
  })
}
