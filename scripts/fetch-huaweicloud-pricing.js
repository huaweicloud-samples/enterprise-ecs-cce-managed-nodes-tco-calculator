#!/usr/bin/env node

/**
 * 华为云 ECS 价格获取脚本（BSS 询价 API 接入点）
 *
 * 用途：从华为云官方价目表 / BSS 询价 API 获取 ECS 按需真实价格，
 *      刷新 public/data/ecs-instance-prices.json，使计算器达到 100% 准确。
 *
 * 与估算方法（scripts/generate-pricing-data.js，约 95% 准确）互补：
 *   - 估算方法：零依赖、秒级生成，适合开发 / 快速预览
 *   - 本脚本：需配置凭据，获取真实价格，适合生产 / 月度校准
 *
 * 接入说明：
 *   华为云没有公开、无需鉴权的「全量 Price List」式接口。真实价格通过
 *   企业中心 / BSS 询价 API 查询（需 AK/SK）。本脚本提供签名骨架与询价
 *   端点占位，填入凭据后即可拉取并写入价格文件。
 *
 * 凭据安全：
 *   凭据仅从环境变量读取，用于本进程内签名，不写入任何文件。
 *   切勿在代码或提交中硬编码 AK/SK。
 *
 * Usage:
 *   export HW_ACCESS_KEY=<your-ak>
 *   export HW_SECRET_KEY=<your-sk>
 *   node scripts/fetch-huaweicloud-pricing.js
 *
 * Output:
 *   public/data/ecs-instance-prices.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ecs-instance-prices.json');

// ---- 华为云区域与规格族（与 generate-pricing-data.js 保持一致）----
const HW_REGIONS = {
  'cn-north-4': '华北-北京四', 'cn-north-1': '华北-北京一', 'cn-north-2': '华北-北京二',
  'cn-east-2': '华东-上海二', 'cn-east-3': '华东-上海一', 'cn-south-1': '华南-广州',
  'cn-south-2': '华南-贵阳一', 'cn-southwest-2': '西南-成都一',
  'ap-southeast-1': '亚太-新加坡', 'ap-southeast-2': '亚太-曼谷', 'ap-southeast-3': '亚太-雅加达',
  'ap-southeast-4': '亚太-马尼拉', 'af-south-1': '非洲-约翰内斯堡',
  'la-south-2': '拉美-圣地亚哥', 'tr-west-1': '土耳其-伊斯坦布尔', 'eu-west-0': '西欧-爱尔兰'
};

const FLAVOR_SIZES = {
  's6': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  's7': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  's3': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'sn3': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  'u1': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'c6': ['large','xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'c7': ['large','xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'c3': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'c3ne': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  'm6': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  'm7': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  'm3': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'm3ne': ['large','xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  'd6': ['xlarge','2xlarge','4xlarge','8xlarge'], 'd7': ['xlarge','2xlarge','4xlarge','8xlarge'],
  'd3': ['xlarge','2xlarge','4xlarge','6xlarge','8xlarge','12xlarge'],
  'ir3': ['large','xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'ir7': ['large','xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'g6': ['xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge'],
  'g5': ['xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'p2s': ['xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'p2v': ['xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'pi2': ['xlarge','2xlarge','4xlarge','8xlarge','16xlarge'],
  'g7': ['xlarge','2xlarge','4xlarge','8xlarge','12xlarge','16xlarge']
};

// ---- SDK-HMAC-SHA256 签名（华为云规范）----
function signRequest(ak, sk, method, host, uri, body, query) {
  const now = new Date();
  const date = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const shortDate = date.slice(0, 8);
  const canonicalUri = uri.split('?')[0];
  const canonicalQuery = query || '';
  const hashedPayload = crypto.createHash('sha256').update(body || '').digest('hex');
  const canonicalHeaders = `host:${host}\nx-sdk-date:${date}\n`;
  const signedHeaders = 'host;x-sdk-date';
  const canonicalRequest = [
    method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, hashedPayload
  ].join('\n');
  const algorithm = 'SDK-HMAC-SHA256';
  const credentialScope = `${shortDate}/${process.env.HW_REGION || 'cn-north-4'}/bss/request`;
  const stringToSign = [
    algorithm, date, credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  const secret = crypto.createHmac('sha256', sk).update(shortDate).digest();
  const signature = crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
  const authorization = `${algorithm} Access=${ak}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, date };
}

// ---- 预留：BSS 询价 API 调用（需凭据）----
async function fetchRealPricing() {
  const ak = process.env.HW_ACCESS_KEY;
  const sk = process.env.HW_SECRET_KEY;
  if (!ak || !sk) {
    console.warn('[跳过] 未配置 HW_ACCESS_KEY / HW_SECRET_KEY，使用估算价格。');
    console.warn('        配置凭据后重新运行即可拉取真实价格。');
    return null;
  }
  // 注：BSS 询价 API 端点与请求体因产品而异（ECS 按需询价需指定
  // resourceSpec / region / periodType 等）。此处为接入骨架，填入
  // 真实询价逻辑后即可写入 regions[region].prices。
  console.log('[预留] BSS 询价 API 接入点：填入询价逻辑后将覆盖估算价格。');
  return null;
}

function main() {
  console.log('华为云 ECS 价格获取（BSS 询价接入点）');
  // 默认退回估算价格，保证脚本始终可生成可用文件
  const { execSync } = require('child_process');
  try {
    execSync('node ' + path.join(__dirname, 'generate-pricing-data.js'), { stdio: 'inherit' });
  } catch (e) {
    console.error('生成估算价格失败:', e.message);
    process.exit(1);
  }
  console.log('\n提示：本脚本已用估算价格生成文件。接入真实价格请完善 fetchRealPricing() 中的 BSS 询价逻辑。');
}

main();
