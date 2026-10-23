# 部署指导书：CCE 托管节点 TCO 计算器

本指导书说明如何将计算器构建为静态站点并托管到华为云对象存储（OBS）静态网站。整条链路**无需后端计算资源**，部署后零运行成本（仅 OBS 存储与出流量按量计费）。

## 1. 前置条件

- 华为云账号，具备 OBS 创建与静态网站配置权限（以及可选的 CDN 管理员权限）。
- 本地安装 Node.js 18+ 与 npm。
- （可选）OBS 命令行工具 `obsutil`，用于上传 `build/` 产物。
- （可选）Terraform 1.5+ 与 `huaweicloud` Provider，用于以 IaC 方式创建静态托管桶。
- 区域建议：以 `cn-north-4`（华北-北京四）为默认部署区域。

## 2. 步骤一：构建静态产物

```bash
cd ecs-cce-managed-nodes-tco-calculator
npm install
npm run build          # 预期：生成 build/ 目录，无编译错误
```

构建完成后，`build/` 即完整的静态站点，`public/data/ecs-instance-prices.json` 已随包打入 `build/data/`。

## 3. 步骤二（任选其一）：创建静态托管桶

### 方式 A — Terraform（推荐，可复现）

```bash
cd infra
terraform init -backend=false
terraform validate      # 预期：Success! The configuration is valid.
terraform plan
terraform apply         # 创建 OBS 桶并开启静态网站 + 公共读策略
```

`terraform apply` 后输出桶名与访问地址：

- `bucket_name`：静态站点所在桶
- `website_endpoint`：OBS 静态网站 HTTP 访问地址

> 费用提示：OBS 标准存储按容量计费、出流量按量计费，整体极低；本实践未启用 CDN，故无 CDN 费用。若后续在 `infra/` 中追加 CDN 资源，请先做费用确认（单资源合计 > ¥10/小时需先确认）。

### 方式 B — 控制台手动创建

1. 在 OBS 控制台新建标准桶（桶名全局唯一）。
2. 开启「静态网站托管」，默认首页 `index.html`、错误页 `404.html`。
3. 配置桶策略，允许匿名用户 `GetObject`（仅限本桶）。

## 4. 步骤三：上传产物

```bash
# 使用 obsutil 将 build/ 上传到桶根目录
obsutil cp -r ./build obs://<你的桶名> -f -flat
```

上传后通过 `terraform output website_endpoint` 或控制台「静态网站托管」页给出的地址访问。

## 5. 步骤四（可选）：接入 CDN 提供 HTTPS

若需 HTTPS 与加速，可在 OBS 静态网站前接入 CDN（内容分发网络），源站填 OBS 静态网站地址，并配置 CNAME。CDN 按流量/请求计费，启用前请确认费用。

## 6. 价格数据刷新（可选）

- 快速刷新（本地估算，约 95% 准确）：`npm run update-pricing`，重新生成 `public/data/ecs-instance-prices.json`，再走步骤二/三重新发布。
- 精准询价（BSS 接入）：配置环境变量 `HW_ACCESS_KEY` / `HW_SECRET_KEY` 后执行 `npm run fetch-pricing`。脚本仅在运行时从环境变量读取凭据，**不写入任何文件**；未配置凭据时自动回退到本地估算。生产环境建议以定时任务方式运行，再重新发布站点。

## 7. 验证部署成功

- 浏览器打开站点地址，确认标题为「CCE 托管节点 TCO 计算器」。
- 选择区域 `cn-north-4` 与规格 `s6.large`，点击「计算成本」，确认结果区出现 ECS 成本、CCE 托管节点服务费与节省百分比。
- 切换币种（如 CNY），确认金额随汇率换算；点击「导出 PDF」确认报告可下载。

## 8. 清理资源

```bash
# 删除已上传的静态对象（避免持续存储计费）
obsutil rm obs://<你的桶名> -r -f

# 若用 Terraform 创建，则销毁桶与策略
cd infra && terraform destroy
```

> 静态托管本身无持续计算计费；清理对象与桶后不再产生 OBS 存储/流量费用。若启用过 CDN，请同步在 CDN 控制台停用并删除加速域名。
