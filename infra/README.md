# infra —— OBS 静态网站托管（Terraform）

本目录以 Terraform + `huaweicloud` Provider 管理计算器的静态托管资源，仅包含对象存储（OBS）相关资源，**不创建任何计算 / 数据库 / 函数资源**。

## 资源清单

| 资源 | 类型 | 计费 | 说明 |
|------|------|------|------|
| `huaweicloud_obs_bucket.site` | OBS 标准桶 + 静态网站 | 按容量 + 出流量 | 存放 `build/` 静态产物 |
| `huaweicloud_obs_bucket_policy.public_read` | 桶策略 | 无 | 允许匿名读取对象 |

> 费用：OBS 标准存储与出流量按量计费，整体极低；本目录未启用 CDN，故无 CDN 费用。若追加 CDN 资源，apply 前需单独做费用确认（合计 > ¥10/小时先确认）。

## 使用

```bash
cd infra
terraform init -backend=false
terraform validate        # 预期：Success! The configuration is valid.
terraform plan
terraform apply           # 创建桶并开启静态网站 + 公共读策略
terraform output website_endpoint   # 获取访问地址
```

## 上传站点产物

Terraform 仅管理桶与策略；静态文件请在 `apply` 之后用 `obsutil` 上传：

```bash
obsutil cp -r ../build obs://<桶名> -f -flat
```

## 清理

```bash
obsutil rm obs://<桶名> -r -f     # 先清空对象，避免持续存储计费
terraform destroy                # 销毁桶与策略
```

## 约束说明

- C6：已通过 `terraform validate`。
- C8：凭据仅通过环境变量 `HW_ACCESS_KEY` / `HW_SECRET_KEY` 注入，不写入本目录任何文件。
- C9：未 apply 前不产生费用；静态托管计费极低。
- C10：桶资源已对 `tags` 加 `lifecycle { ignore_changes = [tags] }`；运行期上传的对象不在 Terraform 管辖内，不会被 `apply` 回滚。
