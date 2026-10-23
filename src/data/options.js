// 华为云区域（计算器可选区域）
export const regions = [
  { label: '华北-北京四 (cn-north-4)', value: 'cn-north-4' },
  { label: '华北-北京一 (cn-north-1)', value: 'cn-north-1' },
  { label: '华北-北京二 (cn-north-2)', value: 'cn-north-2' },
  { label: '华东-上海二 (cn-east-2)', value: 'cn-east-2' },
  { label: '华东-上海一 (cn-east-3)', value: 'cn-east-3' },
  { label: '华南-广州 (cn-south-1)', value: 'cn-south-1' },
  { label: '华南-贵阳一 (cn-south-2)', value: 'cn-south-2' },
  { label: '西南-成都一 (cn-southwest-2)', value: 'cn-southwest-2' },
  { label: '亚太-新加坡 (ap-southeast-1)', value: 'ap-southeast-1' },
  { label: '亚太-曼谷 (ap-southeast-2)', value: 'ap-southeast-2' },
  { label: '亚太-雅加达 (ap-southeast-3)', value: 'ap-southeast-3' },
  { label: '亚太-马尼拉 (ap-southeast-4)', value: 'ap-southeast-4' },
  { label: '非洲-约翰内斯堡 (af-south-1)', value: 'af-south-1' },
  { label: '拉美-圣地亚哥 (la-south-2)', value: 'la-south-2' },
  { label: '土耳其-伊斯坦布尔 (tr-west-1)', value: 'tr-west-1' },
  { label: '西欧-爱尔兰 (eu-west-0)', value: 'eu-west-0' }
];

// 华为云 ECS 规格族按分类组织（分类 -> 规格族 -> 规格列表）
// 注：规格以「族.规格」表示（如 s6.large），未含内存比后缀
const instanceFamilies = {
  '通用型': {
    's6': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
    's7': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
    's3': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
    'sn3': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
    'u1': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge']
  },
  '计算型': {
    'c6': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'c7': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'c3': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
    'c3ne': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge']
  },
  '内存型': {
    'm6': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
    'm7': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
    'm3': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge'],
    'm3ne': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge']
  },
  '存储型': {
    'd6': ['xlarge', '2xlarge', '4xlarge', '8xlarge'],
    'd7': ['xlarge', '2xlarge', '4xlarge', '8xlarge'],
    'd3': ['xlarge', '2xlarge', '4xlarge', '6xlarge', '8xlarge', '12xlarge'],
    'ir3': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'ir7': ['large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge']
  },
  'GPU / 加速型': {
    'g6': ['xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge'],
    'g5': ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'p2s': ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'p2v': ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'pi2': ['xlarge', '2xlarge', '4xlarge', '8xlarge', '16xlarge'],
    'g7': ['xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge']
  }
};

// 展开为扁平实例类型列表（供选择器使用）
const flatInstanceTypes = [];
for (const [category, families] of Object.entries(instanceFamilies)) {
  for (const [family, sizes] of Object.entries(families)) {
    for (const size of sizes) {
      const type = `${family}.${size}`;
      flatInstanceTypes.push({ label: `${type} (${category})`, value: type });
    }
  }
}

export const instanceTypes = flatInstanceTypes;
export const instanceFamiliesByCategory = instanceFamilies;
