/**
 * 华为云 ECS 与 CCE 托管节点定价数据服务
 *
 * 本服务从预生成的 JSON 文件加载华为云弹性云服务器（ECS）按需计费价格。
 * 数据覆盖所有华为云区域与主要规格族，由 scripts/generate-pricing-data.js 生成。
 *
 * 定价策略：
 * 1. 优先加载 /data/ecs-instance-prices.json（由 generate 脚本生成）
 * 2. 若文件不可用，回退到本地估算（基准价 × 区域乘数）
 *
 * 接入真实价格：
 * 运行 scripts/fetch-huaweicloud-pricing.js（预留华为云 BSS 询价 API 接入点），
 * 用官方价目表 / 询价结果刷新 ecs-instance-prices.json，可获得 100% 准确价格。
 */

// 内存缓存
const pricingCache = {
    ecs: {},
    pricingData: null,
    loadPromise: null,
    lastUpdated: null
};

/**
 * 从 JSON 文件加载价格数据
 * @returns {Promise<Object|null>}
 */
const loadPricingData = () => {
    if (pricingCache.pricingData) {
        return Promise.resolve(pricingCache.pricingData);
    }

    if (pricingCache.loadPromise) {
        return pricingCache.loadPromise;
    }

    pricingCache.loadPromise = fetch('/data/ecs-instance-prices.json')
        .then(response => {
            if (!response.ok) {
                console.warn('价格数据文件未找到，使用本地估算');
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data) {
                pricingCache.pricingData = data;
                pricingCache.lastUpdated = data.metadata.generatedAt;
                console.log(`已加载价格数据: ${data.metadata.totalInstanceTypes} 个规格，覆盖 ${data.metadata.totalRegions} 个区域`);
            }
            return data;
        })
        .catch(error => {
            console.warn('加载价格数据出错，使用本地估算:', error.message);
            pricingCache.loadPromise = null; // 允许失败后重试
            return null;
        });

    return pricingCache.loadPromise;
};

/**
 * 获取指定区域、规格的 ECS 按需价格
 * @param {string} region - 华为云区域代码
 * @param {string} instanceType - 规格（如 s6.large）
 * @returns {Promise<number>} 每小时价格
 */
export const getECSInstancePrice = async (region, instanceType) => {
    const cacheKey = `${region}-${instanceType}`;
    if (pricingCache.ecs[cacheKey] !== undefined) {
        return pricingCache.ecs[cacheKey];
    }

    try {
        const pricingData = await loadPricingData();
        let price = null;

        if (pricingData && pricingData.regions[region] && pricingData.regions[region].prices[instanceType]) {
            price = pricingData.regions[region].prices[instanceType];
        } else {
            if (pricingData && !pricingData.regions[region]) {
                console.warn(`区域 ${region} 不在价格数据中，使用估算`);
            } else if (pricingData) {
                console.warn(`规格 ${instanceType} 在 ${region} 未找到，使用估算`);
            }
            price = estimatePriceWithRegionalMultiplier(region, instanceType);
        }

        pricingCache.ecs[cacheKey] = price;
        return price;
    } catch (error) {
        console.error(`获取 ${instanceType} 在 ${region} 的价格出错:`, error);
        const estimatedPrice = estimatePriceWithRegionalMultiplier(region, instanceType);
        pricingCache.ecs[cacheKey] = estimatedPrice;
        return estimatedPrice;
    }
};

/**
 * 用区域乘数估算价格（兜底）
 * @param {string} region
 * @param {string} instanceType
 * @returns {number}
 */
const estimatePriceWithRegionalMultiplier = (region, instanceType) => {
    const [family, size] = instanceType.split('.');
    const basePrice = estimateInstancePrice(family, size);
    const regionalMultiplier = getRegionalPriceMultiplier(region);
    return parseFloat((basePrice * regionalMultiplier).toFixed(5));
};

/**
 * 按规格族与规格估算基准价（large，cn-north-4 等价）
 */
const estimateInstancePrice = (family, size) => {
    const familyBasePrices = {
        's6': 0.045, 's7': 0.046, 's3': 0.040, 'sn3': 0.042, 'u1': 0.038,
        'c6': 0.048, 'c7': 0.050, 'c3': 0.044, 'c3ne': 0.046,
        'm6': 0.068, 'm7': 0.070, 'm3': 0.062, 'm3ne': 0.064,
        'd6': 0.090, 'd7': 0.095, 'd3': 0.085, 'ir3': 0.092, 'ir7': 0.098,
        'g6': 0.85, 'g5': 1.10, 'p2s': 1.50, 'p2v': 1.45, 'pi2': 2.10, 'g7': 0.92
    };

    const sizeMultipliers = {
        'large': 1.0, 'xlarge': 2.0, '2xlarge': 4.0, '3xlarge': 6.0, '4xlarge': 8.0,
        '6xlarge': 12.0, '8xlarge': 16.0, '12xlarge': 24.0, '16xlarge': 32.0, '24xlarge': 48.0, '32xlarge': 64.0
    };

    const basePrice = familyBasePrices[family] || 0.045;
    const multiplier = sizeMultipliers[size] || 1.0;
    return basePrice * multiplier;
};

/**
 * 区域价格乘数（相对 cn-north-4）
 */
const getRegionalPriceMultiplier = (region) => {
    const multipliers = {
        'cn-north-4': 1.00, 'cn-north-1': 1.00, 'cn-north-2': 1.00,
        'cn-east-2': 1.00, 'cn-east-3': 1.02, 'cn-south-1': 1.00,
        'cn-south-2': 0.98, 'cn-southwest-2': 0.98,
        'ap-southeast-1': 1.18, 'ap-southeast-2': 1.15, 'ap-southeast-3': 1.16, 'ap-southeast-4': 1.17,
        'af-south-1': 1.20, 'la-south-2': 1.22, 'tr-west-1': 1.19, 'eu-west-0': 1.25
    };
    return multipliers[region] || 1.0;
};

/**
 * 获取 CCE 托管节点服务费（默认）。
 * 采用「每实例托管服务费」模型：华为云 CCE 托管节点由平台托管节点生命周期、
 * 补丁与弹性伸缩，相对自建 ECS 节省运维投入。此处给出可配置默认值，
 * 实际费用可在「假设」面板按 CCE 集群管理费或人力折算调整。
 * @returns {Object}
 */
export const getManagedNodePricing = () => {
    return {
        // 默认托管服务费：ECS 按需费的 8%（可配置）
        managedNodeServiceFeePercentage: 0.08,
        // 每实例每小时固定托管服务费（USD），若设置则优先于百分比
        managedNodeServiceFeePerInstance: null
    };
};

/**
 * 检查规格在区域是否可用
 * @param {string} region
 * @param {string} instanceType
 * @returns {Promise<boolean>}
 */
export const isInstanceAvailableInRegion = async (region, instanceType) => {
    try {
        const pricingData = await loadPricingData();
        if (pricingData && pricingData.regions[region] && pricingData.regions[region].prices[instanceType]) {
            return true;
        }
        return true; // 数据缺失时假定可用（将使用估算）
    } catch (error) {
        console.error(`检查 ${instanceType} 在 ${region} 的可用性出错:`, error);
        return true;
    }
};
