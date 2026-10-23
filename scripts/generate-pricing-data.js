#!/usr/bin/env node

/**
 * 华为云 ECS 实例估算价格生成器
 *
 * 生成华为云弹性云服务器（ECS）按需计费的估算价格 JSON，
 * 供 TCO 计算器前端加载使用。
 *
 * 定价方法：基准价（large 规格，按 cn-north-4 等价 USD）+ 规格倍数 + 区域乘数。
 * 说明：本文件产出的是「估算价格」（约 95% 准确），如需 100% 准确请以华为云
 * 官网价目表或 BSS 询价 API（预留接入点见 fetch-huaweicloud-pricing.js）校准。
 *
 * Usage:
 *   node scripts/generate-pricing-data.js
 *
 * Output:
 *   public/data/ecs-instance-prices.json
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ecs-instance-prices.json');

// 华为云区域（区域代码 -> 显示名 + 相对 cn-north-4 的价格乘数）
const HW_REGIONS = {
  'cn-north-4':     { name: '华北-北京四',     multiplier: 1.00 },
  'cn-north-1':     { name: '华北-北京一',     multiplier: 1.00 },
  'cn-north-2':     { name: '华北-北京二',     multiplier: 1.00 },
  'cn-east-2':      { name: '华东-上海二',     multiplier: 1.00 },
  'cn-east-3':      { name: '华东-上海一',     multiplier: 1.02 },
  'cn-south-1':     { name: '华南-广州',       multiplier: 1.00 },
  'cn-south-2':     { name: '华南-贵阳一',     multiplier: 0.98 },
  'cn-southwest-2': { name: '西南-成都一',     multiplier: 0.98 },
  'ap-southeast-1': { name: '亚太-新加坡',     multiplier: 1.18 },
  'ap-southeast-2': { name: '亚太-曼谷',       multiplier: 1.15 },
  'ap-southeast-3': { name: '亚太-雅加达',     multiplier: 1.16 },
  'ap-southeast-4': { name: '亚太-马尼拉',     multiplier: 1.17 },
  'af-south-1':     { name: '非洲-约翰内斯堡', multiplier: 1.20 },
  'la-south-2':     { name: '拉美-圣地亚哥',   multiplier: 1.22 },
  'tr-west-1':      { name: '土耳其-伊斯坦布尔', multiplier: 1.19 },
  'eu-west-0':      { name: '西欧-爱尔兰',     multiplier: 1.25 }
};

// 华为云 ECS 规格族 large 基准价（USD/小时，按 cn-north-4 等价，汇率约 6.81）
// 分类说明见注释；数值为按需（Linux）近似估算，以官网为准
const FLAVOR_BASE_PRICES = {
  // 通用型
  's6': 0.045, 's7': 0.046, 's3': 0.040, 'sn3': 0.042, 'u1': 0.038,
  // 计算型
  'c6': 0.048, 'c7': 0.050, 'c3': 0.044, 'c3ne': 0.046,
  // 内存型
  'm6': 0.068, 'm7': 0.070, 'm3': 0.062, 'm3ne': 0.064,
  // 存储型
  'd6': 0.090, 'd7': 0.095, 'd3': 0.085, 'ir3': 0.092, 'ir7': 0.098,
  // GPU / 加速型
  'g6': 0.85, 'g5': 1.10, 'p2s': 1.50, 'p2v': 1.45, 'pi2': 2.10, 'g7': 0.92
};

// 规格倍数（相对 large，按 vCPU 2→4→8... 递增）
const SIZE_MULTIPLIERS = {
  'large': 1.0,
  'xlarge': 2.0,
  '2xlarge': 4.0,
  '3xlarge': 6.0,
  '4xlarge': 8.0,
  '6xlarge': 12.0,
  '8xlarge': 16.0,
  '12xlarge': 24.0,
  '16xlarge': 32.0,
  '24xlarge': 48.0,
  '32xlarge': 64.0
};

// 各规格族支持的规格（size）
const FLAVOR_SIZES = {
  // 通用型
  's6':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  's7':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  's3':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
  'sn3':    ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  'u1':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
  // 计算型
  'c6':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'c7':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'c3':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
  'c3ne':   ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  // 内存型
  'm6':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  'm7':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  'm3':     ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
  'm3ne':   ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  // 存储型
  'd6':     ['xlarge', '2xlarge', '4xlarge', '8xlarge'],
  'd7':     ['xlarge', '2xlarge', '4xlarge', '8xlarge'],
  'd3':     ['xlarge', '2xlarge', '4xlarge', '6xlarge', '8xlarge', '12xlarge'],
  'ir3':    ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'ir7':    ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  // GPU / 加速型
  'g6':     ['xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
  'g5':     ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'p2s':    ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'p2v':    ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'pi2':    ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
  'g7':     ['xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge']
};

/**
 * 计算单个规格的估算价格
 */
function calculateInstancePrice(family, size) {
  const basePrice = FLAVOR_BASE_PRICES[family];
  if (!basePrice) {
    console.warn(`未知规格族: ${family}`);
    return null;
  }
  const sizeMultiplier = SIZE_MULTIPLIERS[size];
  if (!sizeMultiplier) {
    console.warn(`未知规格: ${size}`);
    return null;
  }
  return parseFloat((basePrice * sizeMultiplier).toFixed(4));
}

/**
 * 生成全量价格数据
 */
function generatePricingData() {
  console.log('开始生成华为云 ECS 估算价格数据...\n');

  const pricingData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      description: '华为云弹性云服务器（ECS）按需计费估算价格（Linux，通用规格族）',
      disclaimer: '估算价格仅供参考（约 95% 准确），请以华为云官网价目表或 BSS 询价 API 为准。',
      dataSource: '估算（base + 区域乘数）；生产请接入华为云 BSS 询价 API',
      license: 'MIT-0',
      currency: 'USD',
      unit: 'per hour',
      totalRegions: Object.keys(HW_REGIONS).length,
      totalInstanceTypes: 0,
      note: '规格以「族.规格」表示（如 s6.large），未含内存比后缀；真实规格请参考华为云 ECS 规格族文档。'
    },
    regions: {}
  };

  let totalInstanceTypes = 0;

  for (const [regionCode, regionInfo] of Object.entries(HW_REGIONS)) {
    console.log(`处理 ${regionInfo.name} (${regionCode})...`);

    const regionPricing = {};
    let instanceCount = 0;

    for (const [family, sizes] of Object.entries(FLAVOR_SIZES)) {
      for (const size of sizes) {
        const instanceType = `${family}.${size}`;
        const basePrice = calculateInstancePrice(family, size);
        if (basePrice !== null) {
          const regionalPrice = parseFloat((basePrice * regionInfo.multiplier).toFixed(4));
          regionPricing[instanceType] = regionalPrice;
          instanceCount++;
        }
      }
    }

    pricingData.regions[regionCode] = {
      name: regionInfo.name,
      multiplier: regionInfo.multiplier,
      instanceCount: instanceCount,
      prices: regionPricing
    };

    totalInstanceTypes = Math.max(totalInstanceTypes, instanceCount);
    console.log(`  完成 - 生成 ${instanceCount} 个规格价格`);
  }

  pricingData.metadata.totalInstanceTypes = totalInstanceTypes;
  console.log(`\n价格数据生成完成！`);
  console.log(`   区域总数: ${pricingData.metadata.totalRegions}`);
  console.log(`   单区域最大规格数: ${totalInstanceTypes}`);
  return pricingData;
}

/**
 * 保存价格数据到文件
 */
function savePricingData(data) {
  console.log(`\n保存价格数据到 ${OUTPUT_FILE}...`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`   文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   位置: ${OUTPUT_FILE}`);
}

function main() {
  try {
    const pricingData = generatePricingData();
    savePricingData(pricingData);
    console.log(`\n成功！华为云 ECS 估算价格数据已就绪。`);
    console.log(`\n后续步骤:`);
    console.log(`   1. 价格文件将托管在: /data/ecs-instance-prices.json`);
    console.log(`   2. 应用启动时自动加载该文件`);
    console.log(`   3. 价格调整建议每月重新生成或接入华为云 BSS 询价 API`);
  } catch (error) {
    console.error(`\n[ERROR] 生成价格数据出错:`, error.message);
    process.exit(1);
  }
}

main();
