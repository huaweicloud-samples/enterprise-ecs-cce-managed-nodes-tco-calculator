# 提供商配置（区域可由变量覆盖；凭据通过环境变量 HW_ACCESS_KEY / HW_SECRET_KEY 注入，不落盘）
provider "huaweicloud" {
  region = var.region
}

# OBS 桶：静态网站托管
# 桶本身仅作存储，运行期上传的对象由 obsutil 在 apply 之后写入，
# 故 Terraform 不声明会被运行期改写的对象；tags 让出所有权满足 C10。
resource "huaweicloud_obs_bucket" "site" {
  bucket = var.bucket_name

  # 静态网站配置：默认首页与错误页
  website {
    index_document = "index.html"
    error_document = "404.html"
  }

  lifecycle {
    ignore_changes = [tags]
  }
}

# 桶策略：允许匿名用户读取对象（静态网站公开访问）
resource "huaweicloud_obs_bucket_policy" "public_read" {
  bucket = huaweicloud_obs_bucket.site.bucket

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowPublicReadForStaticWebsite"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["GetObject"]
        Resource  = ["${huaweicloud_obs_bucket.site.bucket}/*"]
      }
    ]
  })
}
