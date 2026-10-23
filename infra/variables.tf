variable "region" {
  type        = string
  description = "华为云区域，静态站点默认部署区域"
  default     = "cn-north-4"
}

variable "bucket_name" {
  type        = string
  description = "全局唯一的 OBS 桶名，用于静态网站托管（需自行替换为唯一名称）"
  default     = "cce-managed-nodes-tco-calculator"
}
