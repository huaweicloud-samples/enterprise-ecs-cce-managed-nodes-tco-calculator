import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  FormField,
  Input,
  Select,
  Button,
  SpaceBetween,
  Grid,
  Box,
  Alert
} from '@cloudscape-design/components';
import { regions, instanceTypes } from '../data/options';
import { isInstanceAvailableInRegion, getECSInstancePrice } from '../services/pricingService';

function Calculator({ onCalculate, assumptions }) {
  const [formData, setFormData] = useState({
    region: 'cn-north-4',
    hoursPerMonth: 730,
    instanceGroups: [
      { instanceType: 's6.large', instanceCount: 2, managedNodeServiceFeePerHour: null }
    ]
  });

  const [instancePrices, setInstancePrices] = useState({});
  const [showAvailabilityWarning, setShowAvailabilityWarning] = useState(false);
  const [pricesFetched, setPricesFetched] = useState(false);

  // 区域或规格变化时拉取 ECS 价格
  useEffect(() => {
    const fetchPrices = async () => {
      const region = formData.region;
      const newPrices = {};
      let needsFetch = false;

      for (const group of formData.instanceGroups) {
        const key = `${region}-${group.instanceType}`;
        if (!instancePrices[key]) {
          needsFetch = true;
          const ecsPrice = await getECSInstancePrice(region, group.instanceType);
          newPrices[key] = ecsPrice;
        }
      }

      if (needsFetch && Object.keys(newPrices).length > 0) {
        setInstancePrices(prev => ({ ...prev, ...newPrices }));
      }
      setPricesFetched(true);
    };

    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.region, formData.instanceGroups.map(g => g.instanceType).join(',')]);

  // 价格就绪后计算托管节点服务费
  useEffect(() => {
    if (!pricesFetched) return;

    const updatedGroups = formData.instanceGroups.map(group => {
      const key = `${formData.region}-${group.instanceType}`;
      const ecsPrice = instancePrices[key];

      if (ecsPrice !== undefined && group.managedNodeServiceFeePerHour === null) {
        const feePercentage = assumptions?.managedNodeServiceFeePercentage || 0.08;
        return {
          ...group,
          managedNodeServiceFeePerHour: parseFloat((ecsPrice * feePercentage).toFixed(5))
        };
      }
      return group;
    });

    const hasChanges = updatedGroups.some((group, index) =>
      group.managedNodeServiceFeePerHour !== formData.instanceGroups[index].managedNodeServiceFeePerHour
    );

    if (hasChanges) {
      setFormData(prev => ({
        ...prev,
        instanceGroups: updatedGroups
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instancePrices, pricesFetched, formData.instanceGroups.map(g => `${g.instanceType}-${g.managedNodeServiceFeePerHour}`).join(',')]);

  // 区域变化时校验实例可用性
  useEffect(() => {
    const checkInstanceAvailability = async () => {
      const region = formData.region;
      let hasUnavailableInstances = false;

      for (const group of formData.instanceGroups) {
        const isAvailable = await isInstanceAvailableInRegion(region, group.instanceType);
        if (!isAvailable) {
          hasUnavailableInstances = true;
        }
      }
      setShowAvailabilityWarning(hasUnavailableInstances);
    };
    checkInstanceAvailability();
  }, [formData.region, formData.instanceGroups]);

  const handleInputChange = (field, value) => {
    if (field === 'region') {
      setFormData(prev => ({
        ...prev,
        [field]: value,
        instanceGroups: prev.instanceGroups.map(group => ({
          ...group,
          managedNodeServiceFeePerHour: null
        }))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleInstanceGroupChange = (index, field, value) => {
    const updatedGroups = [...formData.instanceGroups];
    if (field === 'instanceType') {
      updatedGroups[index] = {
        ...updatedGroups[index],
        [field]: value,
        managedNodeServiceFeePerHour: null
      };
    } else {
      updatedGroups[index] = {
        ...updatedGroups[index],
        [field]: value
      };
    }
    setFormData(prev => ({
      ...prev,
      instanceGroups: updatedGroups
    }));
  };

  const addInstanceGroup = () => {
    setFormData(prev => ({
      ...prev,
      instanceGroups: [
        ...prev.instanceGroups,
        { instanceType: 's6.large', instanceCount: 1, managedNodeServiceFeePerHour: null }
      ]
    }));
  };

  const removeInstanceGroup = (index) => {
    if (formData.instanceGroups.length > 1) {
      const updatedGroups = [...formData.instanceGroups];
      updatedGroups.splice(index, 1);
      setFormData(prev => ({
        ...prev,
        instanceGroups: updatedGroups
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      hoursPerMonth: formData.hoursPerMonth === '' ? 730 : formData.hoursPerMonth
    };
    onCalculate(submitData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Container
        header={<Header variant="h2">CCE 托管节点配置</Header>}
      >
        <SpaceBetween size="l">
          <Alert
            type="info"
            header="关于 CCE 托管节点服务费"
          >
            计算器使用默认的 CCE 托管节点服务费。该费用可按实例调整，或在「假设」面板更新默认值。
          </Alert>

          {showAvailabilityWarning && (
            <Alert
              type="warning"
              header="实例可用性提示"
              dismissible
            >
              所选规格在当前区域可能不可用。若未找到价格数据，将使用估算价格。
            </Alert>
          )}

          <Header variant="h3">区域与使用量</Header>

          <Grid
            gridDefinition={[
              { colspan: { default: 12, xxs: 6 } },
              { colspan: { default: 12, xxs: 6 } }
            ]}
          >
            <FormField label="区域">
              <Select
                selectedOption={{ label: regions.find(r => r.value === formData.region).label, value: formData.region }}
                onChange={({ detail }) => handleInputChange('region', detail.selectedOption.value)}
                options={regions}
              />
            </FormField>

            <FormField
              label="每月运行时长（小时）"
              description="工作负载每月运行小时数。7×24 用 730，或按实际使用填写。"
            >
              <Input
                type="number"
                value={formData.hoursPerMonth === '' ? '' : formData.hoursPerMonth.toString()}
                onChange={({ detail }) => handleInputChange('hoursPerMonth', detail.value === '' ? '' : parseInt(detail.value))}
                min={1}
                max={744}
              />
            </FormField>
          </Grid>

          <Header
            variant="h3"
            description="当前支撑工作负载的弹性云服务器（ECS）实例数量"
          >
            弹性云服务器（ECS）实例详情
          </Header>

          {formData.instanceGroups.map((group, index) => (
            <Box
              key={index}
              padding="m"
              variant="code"
            >
              <SpaceBetween size="m">
                <Grid
                  gridDefinition={[
                    { colspan: { default: 12, xxs: 4 } },
                    { colspan: { default: 12, xxs: 4 } },
                    { colspan: { default: 12, xxs: 4 } }
                  ]}
                >
                  <FormField label="规格">
                    <Select
                      selectedOption={{
                        label: group.instanceType,
                        value: group.instanceType
                      }}
                      onChange={({ detail }) =>
                        handleInstanceGroupChange(index, 'instanceType', detail.selectedOption.value)
                      }
                      options={instanceTypes}
                      filteringType="auto"
                      filteringPlaceholder="搜索规格"
                      filteringAriaLabel="筛选规格"
                    />
                  </FormField>

                  <FormField label="实例数量">
                    <Input
                      type="number"
                      value={group.instanceCount.toString()}
                      onChange={({ detail }) =>
                        handleInstanceGroupChange(index, 'instanceCount', parseInt(detail.value) || 1)
                      }
                      min={1}
                    />
                  </FormField>

                  <FormField
                    label="CCE 托管节点服务费（$/小时）"
                  >
                    <Input
                      type="number"
                      step="0.00001"
                      value={group.managedNodeServiceFeePerHour !== null ? group.managedNodeServiceFeePerHour.toString() : ''}
                      onChange={({ detail }) =>
                        handleInstanceGroupChange(index, 'managedNodeServiceFeePerHour', parseFloat(detail.value) || 0)
                      }
                      min={0}
                      placeholder="计算中..."
                    />
                  </FormField>
                </Grid>

                {formData.instanceGroups.length > 1 && (
                  <Button
                    variant="link"
                    onClick={() => removeInstanceGroup(index)}
                  >
                    移除
                  </Button>
                )}
              </SpaceBetween>
            </Box>
          ))}

          <Button
            onClick={addInstanceGroup}
            variant="normal"
          >
            添加另一个规格
          </Button>

          <Button
            variant="primary"
            formAction="submit"
          >
            计算 TCO
          </Button>
        </SpaceBetween>
      </Container>
    </form>
  );
}

export default Calculator;
