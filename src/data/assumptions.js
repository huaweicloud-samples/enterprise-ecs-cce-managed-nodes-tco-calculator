// 默认假设（CCE 托管节点 TCO 计算器）
export const defaultAssumptions = {
  // 人力成本
  platformEngineerSalary: 150000, // 年薪（USD）
  platformEngineerHourlyRate: 72.12, // 时薪 = 年薪 / 年工时
  workingHoursPerYear: 2080, // 40 小时/周 * 52 周

  // 托管节点服务费（占 ECS 按需费的百分比）
  managedNodeServiceFeePercentage: 0.08, // 默认值 8%

  // 装箱 / 利用率假设
  binPacking: {
    currentUtilization: 0.60, // 标准 ECS 自建平均利用率
    managedUtilization: 0.90, // CCE 托管节点目标利用率
    description: 'CCE 托管节点装箱更密，可用更少实例承载相同工作负载。'
  },

  // 集群 / 机队式管理工时模型（固定月度开销）
  managementTimeModel: {
    standardEC2: {
      baseHoursPerMonth: 12, // 标准 ECS 自建构弹性伸缩组、镜像、补丁、监控、伸缩策略的固定开销
      breakdown: {
        asgConfiguration: 2, // 弹性伸缩组配置、调优与维护
        launchTemplateManagement: 2, // 镜像（私有镜像）更新与版本管理
        amiManagement: 3, // 自定义镜像创建、测试与更新
        scalingPolicyOptimization: 1, // 伸缩策略调优与测试
        securityPatching: 4 // 补丁协调、测试与发布
      },
      description: '包含弹性伸缩组管理、自定义镜像维护、补丁协调与伸缩策略调优。'
    },
    ecsManaged: {
      baseHoursPerMonth: 2, // CCE 托管节点仅节点池监控的极简开销
      breakdown: {
        capacityProviderConfiguration: 1, // 初始配置与偶发调优
        capacityPlanning: 1 // 少量的容量规划评审
      },
      description: '包含节点池监控。多数运维（补丁、伸缩、镜像管理）由平台自动化完成。'
    }
  }
};
