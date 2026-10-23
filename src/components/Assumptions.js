import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  FormField,
  Input,
  Button,
  SpaceBetween,
  Grid,
  Box,
  TextContent,
  Alert
} from '@cloudscape-design/components';
import { defaultAssumptions } from '../data/assumptions';

function Assumptions({ assumptions, onUpdateAssumptions }) {
  const mgmtModel = assumptions.managementTimeModel;

  const [formData, setFormData] = useState({
    platformEngineerSalary: assumptions.platformEngineerSalary,
    workingHoursPerYear: assumptions.workingHoursPerYear,
    // 机队式管理模型
    standardEC2BaseHours: mgmtModel.standardEC2.baseHoursPerMonth,
    ecsManagedBaseHours: mgmtModel.ecsManaged.baseHoursPerMonth,
    managedNodeServiceFeePercentage: assumptions.managedNodeServiceFeePercentage * 100,
    // 装箱利用率
    currentUtilization: (assumptions.binPacking?.currentUtilization || 0.60) * 100,
    managedUtilization: (assumptions.binPacking?.managedUtilization || 0.90) * 100
  });

  const [hourlyRate, setHourlyRate] = useState(
    assumptions.platformEngineerSalary / assumptions.workingHoursPerYear
  );

  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const calculatedRate = formData.platformEngineerSalary / formData.workingHoursPerYear;
    setHourlyRate(calculatedRate);
  }, [formData.platformEngineerSalary, formData.workingHoursPerYear]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const updatedAssumptions = {
      ...assumptions,
      platformEngineerSalary: formData.platformEngineerSalary,
      workingHoursPerYear: formData.workingHoursPerYear,
      platformEngineerHourlyRate: hourlyRate,
      managementTimeModel: {
        standardEC2: {
          ...mgmtModel.standardEC2,
          baseHoursPerMonth: formData.standardEC2BaseHours
        },
        ecsManaged: {
          ...mgmtModel.ecsManaged,
          baseHoursPerMonth: formData.ecsManagedBaseHours
        }
      },
      managedNodeServiceFeePercentage: formData.managedNodeServiceFeePercentage / 100,
      binPacking: {
        currentUtilization: formData.currentUtilization / 100,
        managedUtilization: formData.managedUtilization / 100,
        description: assumptions.binPacking?.description || 'CCE 托管节点装箱更密，可用更少实例承载相同工作负载。'
      }
    };

    onUpdateAssumptions(updatedAssumptions);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    const defaultModel = defaultAssumptions.managementTimeModel;
    setFormData({
      platformEngineerSalary: 150000,
      workingHoursPerYear: 2080,
      standardEC2BaseHours: defaultModel.standardEC2.baseHoursPerMonth,
      ecsManagedBaseHours: defaultModel.ecsManaged.baseHoursPerMonth,
      managedNodeServiceFeePercentage: 8,
      currentUtilization: 60,
      managedUtilization: 90
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SpaceBetween size="l">
        {showSuccess && (
          <Alert
            type="success"
            dismissible
            onDismiss={() => setShowSuccess(false)}
          >
            假设已更新！重新计算成本以查看更新后的值。
          </Alert>
        )}

        <Container
          header={<Header variant="h2">平台工程成本</Header>}
        >
          <SpaceBetween size="l">
            <Grid
              gridDefinition={[
                { colspan: { default: 12, xxs: 6 } },
                { colspan: { default: 12, xxs: 6 } }
              ]}
            >
              <FormField label="平台工程师年薪（$）">
                <Input
                  type="number"
                  value={formData.platformEngineerSalary.toString()}
                  onChange={({ detail }) =>
                    handleInputChange('platformEngineerSalary', parseFloat(detail.value) || 0)
                  }
                  min={0}
                />
              </FormField>

              <FormField label="年工时">
                <Input
                  type="number"
                  value={formData.workingHoursPerYear.toString()}
                  onChange={({ detail }) =>
                    handleInputChange('workingHoursPerYear', parseFloat(detail.value) || 1)
                  }
                  min={1}
                />
              </FormField>
            </Grid>

            <Grid
              gridDefinition={[
                { colspan: { default: 12, xxs: 6 } }
              ]}
            >
              <FormField label="计算时薪">
                <Box padding="m" variant="code">
                  ${hourlyRate.toFixed(2)}
                </Box>
              </FormField>
            </Grid>
          </SpaceBetween>
        </Container>

        <Container
          header={
            <Header
              variant="h2"
              description="机队式模型：弹性伸缩组 / 节点池管理的固定月度开销"
            >
              基础设施管理
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Header variant="h3">标准弹性云服务器（ECS）自建 + 弹性伸缩组</Header>
            <FormField
              label="每月管理工时"
              description="固定开销：弹性伸缩组配置、镜像管理、补丁、监控、伸缩策略"
            >
              <Input
                type="number"
                step="1"
                value={formData.standardEC2BaseHours.toString()}
                onChange={({ detail }) =>
                  handleInputChange('standardEC2BaseHours', parseFloat(detail.value) || 0)
                }
                min={0}
              />
            </FormField>

            {mgmtModel.standardEC2.breakdown && (
              <Box variant="awsui-key-label">
                <TextContent>
                  <small>明细：弹性伸缩组配置 ({mgmtModel.standardEC2.breakdown.asgConfiguration}h) +
                  镜像管理 ({mgmtModel.standardEC2.breakdown.launchTemplateManagement}h) +
                  镜像维护 ({mgmtModel.standardEC2.breakdown.amiManagement}h) +
                  伸缩策略 ({mgmtModel.standardEC2.breakdown.scalingPolicyOptimization}h) +
                  补丁 ({mgmtModel.standardEC2.breakdown.securityPatching}h)</small>
                </TextContent>
              </Box>
            )}

            <Header variant="h3">云容器引擎（CCE）托管节点（节点池）</Header>
            <FormField
              label="每月管理工时"
              description="固定开销：节点池监控、容量规划"
            >
              <Input
                type="number"
                step="1"
                value={formData.ecsManagedBaseHours.toString()}
                onChange={({ detail }) =>
                  handleInputChange('ecsManagedBaseHours', parseFloat(detail.value) || 0)
                }
                min={0}
              />
            </FormField>

            {mgmtModel.ecsManaged.breakdown && (
              <Box variant="awsui-key-label">
                <TextContent>
                  <small>明细：节点池配置 ({mgmtModel.ecsManaged.breakdown.capacityProviderConfiguration}h) +
                  容量规划 ({mgmtModel.ecsManaged.breakdown.capacityPlanning}h)</small>
                </TextContent>
              </Box>
            )}

            <FormField
              label="CCE 托管节点服务费（%）"
              description="ECS 按需费的默认百分比（可在计算器中按实例覆盖）"
            >
              <Input
                type="number"
                step="0.1"
                value={formData.managedNodeServiceFeePercentage.toString()}
                onChange={({ detail }) =>
                  handleInputChange('managedNodeServiceFeePercentage', parseFloat(detail.value) || 0)
                }
                min={0}
                max={100}
              />
            </FormField>

            <Header variant="h3">装箱 / 实例利用率</Header>
            <Box variant="awsui-key-label">
              <TextContent>
                <small>CCE 托管节点装箱更密，可用更少实例承载相同工作负载。
                优化实例数计算公式：ceil(当前数量 × 当前利用率 / 托管节点目标利用率)</small>
              </TextContent>
            </Box>
            <Grid
              gridDefinition={[
                { colspan: { default: 12, xxs: 6 } },
                { colspan: { default: 12, xxs: 6 } }
              ]}
            >
              <FormField
                label="当前弹性云服务器（ECS）利用率（%）"
                description="现有弹性云服务器（ECS）实例的平均利用率"
              >
                <Input
                  type="number"
                  step="1"
                  value={formData.currentUtilization.toString()}
                  onChange={({ detail }) =>
                    handleInputChange('currentUtilization', parseFloat(detail.value) || 0)
                  }
                  min={1}
                  max={100}
                />
              </FormField>

              <FormField
                label="CCE 托管节点目标利用率（%）"
                description="采用 CCE 托管节点装箱优化后的预期利用率"
              >
                <Input
                  type="number"
                  step="1"
                  value={formData.managedUtilization.toString()}
                  onChange={({ detail }) =>
                    handleInputChange('managedUtilization', parseFloat(detail.value) || 0)
                  }
                  min={1}
                  max={100}
                />
              </FormField>
            </Grid>
          </SpaceBetween>
        </Container>

        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            formAction="submit"
          >
            更新假设
          </Button>
          <Button
            onClick={handleReset}
          >
            恢复默认
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </form>
  );
}

export default Assumptions;
