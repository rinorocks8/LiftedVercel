resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for liftedprofiles S3 bucket"
}

resource "aws_s3_bucket" "liftedprofiles" {
  bucket = "liftedprofiles"
}

resource "aws_s3_bucket_lifecycle_configuration" "liftedprofiles" {
  bucket = aws_s3_bucket.liftedprofiles.id
  rule {
    id     = "versioning-rule"
    status = "Enabled"
    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}

resource "aws_s3_bucket_versioning" "liftedprofiles" {
  bucket = aws_s3_bucket.liftedprofiles.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_cors_configuration" "liftedprofiles" {
  bucket = aws_s3_bucket.liftedprofiles.id

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
  }
}

resource "aws_s3_bucket_ownership_controls" "liftedprofiles" {
  bucket = aws_s3_bucket.liftedprofiles.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "liftedprofiles" {
  bucket = aws_s3_bucket.liftedprofiles.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_acl" "liftedprofiles" {
  depends_on = [
    aws_s3_bucket_ownership_controls.liftedprofiles,
    aws_s3_bucket_public_access_block.liftedprofiles,
  ]

  bucket = aws_s3_bucket.liftedprofiles.id
  acl    = "public-read"
}

resource "aws_cloudfront_distribution" "liftedprofiles_distribution" {
  origin {
    domain_name = aws_s3_bucket.liftedprofiles.bucket_regional_domain_name
    origin_id   = "S3-liftedprofiles"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-liftedprofiles"

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "allow-all"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
