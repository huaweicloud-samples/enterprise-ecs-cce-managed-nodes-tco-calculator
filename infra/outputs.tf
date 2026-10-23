output "bucket_name" {
  description = "静态站点所在 OBS 桶名"
  value       = huaweicloud_obs_bucket.site.bucket
}

output "website_endpoint" {
  description = "OBS 静态网站访问地址（网站托管端点）"
  value       = "https://${huaweicloud_obs_bucket.site.bucket}.obs-website.${var.region}.myhuaweicloud.com"
}
