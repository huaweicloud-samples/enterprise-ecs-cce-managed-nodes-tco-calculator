import React, { useState } from 'react';
import { AppLayout, Container, Header, SpaceBetween, ExpandableSection, Select, FormField, Input, Grid, Alert } from '@cloudscape-design/components';
import Calculator from './components/Calculator';
import Results from './components/Results';
import Assumptions from './components/Assumptions';
import { getECSInstancePrice } from './services/pricingService';
import { defaultAssumptions } from './data/assumptions';
import { currencies, defaultCurrency, getCurrency } from './data/currencies';

function App() {
  const [results, setResults] = useState(null);
  const [calculationError, setCalculationError] = useState(null);
  const [isResultsExpanded, setIsResultsExpanded] = useState(true);
  const [isAssumptionsExpanded, setIsAssumptionsExpanded] = useState(false);
  const [assumptions, setAssumptions] = useState({ ...defaultAssumptions });
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency);
  const [exchangeRate, setExchangeRate] = useState(getCurrency(defaultCurrency).rate);

  const updateAssumptions = (newAssumptions) => {
    setAssumptions(newAssumptions);
  };

  const handleCurrencyChange = (currencyCode) => {
    setSelectedCurrency(currencyCode);
    const currency = getCurrency(currencyCode);
    setExchangeRate(currency.rate);
  };

  const handleExchangeRateChange = (newRate) => {
    setExchangeRate(newRate);
  };

  const calculateCosts = async (formData) => {
    try {
      setCalculationError(null);
      const { region, hoursPerMonth, instanceGroups } = formData;

      if (!region || typeof region !== 'string') {
        throw new Error('请选择一个有效的区域。');
      }
      if (!hoursPerMonth || hoursPerMonth < 1 || hoursPerMonth > 744) {
        throw new Error('每月运行时长需在 1 到 744 之间。');
      }
      if (!Array.isArray(instanceGroups) || instanceGroups.length === 0) {
        throw new Error('请至少添加一个实例组。');
      }

      const totalInstances = instanceGroups.reduce((sum, group) => sum + group.instanceCount, 0);

      // 装箱优化：计算 CCE 托管节点的优化实例数
      const currentUtil = assumptions.binPacking?.currentUtilization || 0.60;
      const managedUtil = assumptions.binPacking?.managedUtilization || 0.90;

      const instanceBreakdown = await Promise.all(
        instanceGroups.map(async group => {
          const { instanceType, instanceCount, managedNodeServiceFeePerHour } = group;
          const instanceHourlyCost = await getECSInstancePrice(region, instanceType);

          // 标准 ECS 自建：原始实例数
          const ec2Cost = instanceCount * instanceHourlyCost * hoursPerMonth;

          // CCE 托管节点：装箱优化后的实例数
          const optimizedCount = Math.ceil(instanceCount * currentUtil / managedUtil);
          const optimizedEC2Cost = optimizedCount * instanceHourlyCost * hoursPerMonth;

          const managementFee = managedNodeServiceFeePerHour !== null
            ? managedNodeServiceFeePerHour
            : instanceHourlyCost * assumptions.managedNodeServiceFeePercentage;

          const managedNodeInstancesFee = optimizedCount * managementFee * hoursPerMonth;

          return {
            instanceType,
            count: instanceCount,
            optimizedCount,
            ec2Cost,
            optimizedEC2Cost,
            managedNodeInstancesFee,
            managedNodeServiceFeePerHour: managementFee,
            totalCost: ec2Cost + managedNodeInstancesFee
          };
        })
      );

      const totalEC2Cost = instanceBreakdown.reduce((sum, item) => sum + item.ec2Cost, 0);
      const totalOptimizedEC2Cost = instanceBreakdown.reduce((sum, item) => sum + item.optimizedEC2Cost, 0);
      const totalManagedNodeFee = instanceBreakdown.reduce((sum, item) => sum + item.managedNodeInstancesFee, 0);
      const totalOptimizedInstances = instanceBreakdown.reduce((sum, item) => sum + item.optimizedCount, 0);

      const mgmtModel = assumptions.managementTimeModel;
      const standardEC2StaffingHours = mgmtModel.standardEC2.baseHoursPerMonth;
      const managedNodeStaffingHours = mgmtModel.ecsManaged.baseHoursPerMonth;

      const standardEC2StaffingCost = standardEC2StaffingHours * assumptions.platformEngineerHourlyRate;
      const managedNodeStaffingCost = managedNodeStaffingHours * assumptions.platformEngineerHourlyRate;

      const standardEC2TotalCost = totalEC2Cost + standardEC2StaffingCost;
      const managedNodeTotalCost = totalOptimizedEC2Cost + totalManagedNodeFee + managedNodeStaffingCost;

      const savings = standardEC2TotalCost - managedNodeTotalCost;
      const savingsPercentage = standardEC2TotalCost > 0 ? (savings / standardEC2TotalCost) * 100 : 0;

      setResults({
        region,
        instanceBreakdown,
        totalEC2Cost,
        totalOptimizedEC2Cost,
        totalManagedNodeFee,
        totalInstances,
        totalOptimizedInstances,
        binPacking: {
          currentUtilization: currentUtil,
          managedUtilization: managedUtil,
          instancesSaved: totalInstances - totalOptimizedInstances,
          ec2Savings: totalEC2Cost - totalOptimizedEC2Cost
        },
        standardEC2StaffingHours,
        managedNodeStaffingHours,
        standardEC2StaffingCost,
        managedNodeStaffingCost,
        standardEC2TotalCost,
        managedNodeTotalCost,
        savings,
        savingsPercentage,
        managementTimeModel: mgmtModel
      });

      setIsResultsExpanded(true);
    } catch (error) {
      console.error('成本计算失败:', error);
      setCalculationError(error.message || '计算过程中发生未知错误。');
      setResults(null);
    }
  };

  return (
    <AppLayout
      navigationHide
      toolsHide
      content={
        <Container>
          <SpaceBetween size="l">
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Header
                variant="h1"
                description="计算弹性云服务器（ECS）自建与云容器引擎（CCE）托管节点的总体拥有成本（TCO）对比"
              >
                CCE 托管节点 TCO 计算器
              </Header>
            </SpaceBetween>

            <Container>
              <SpaceBetween size="m">
                <Header variant="h3">货币设置</Header>

                <Alert type="info" header="汇率说明">
                  汇率为近似值，可能不反映实时市场汇率。请从可靠来源核实当前汇率并调整下方数值以获得准确估算。
                </Alert>

                <Grid
                  gridDefinition={[
                    { colspan: { default: 12, xxs: 6 } },
                    { colspan: { default: 12, xxs: 6 } }
                  ]}
                >
                  <FormField label="首选货币">
                    <Select
                      selectedOption={currencies.find(c => c.value === selectedCurrency)}
                      onChange={({ detail }) => handleCurrencyChange(detail.selectedOption.value)}
                      options={currencies}
                      placeholder="选择货币"
                      ariaLabel="货币选择器"
                    />
                  </FormField>

                  <FormField
                    label="汇率（基于 USD）"
                    description={`1 USD = ${exchangeRate} ${selectedCurrency}`}
                  >
                    <Input
                      type="number"
                      step="0.0001"
                      value={exchangeRate.toString()}
                      onChange={({ detail }) => handleExchangeRateChange(parseFloat(detail.value) || 1)}
                      disabled={selectedCurrency === 'USD'}
                    />
                  </FormField>
                </Grid>
              </SpaceBetween>
            </Container>

            <SpaceBetween size="l">
              <Calculator onCalculate={calculateCosts} assumptions={assumptions} />

              <Container>
                <ExpandableSection
                  headerText="假设"
                  variant="container"
                  expanded={isAssumptionsExpanded}
                  onChange={({ detail }) => setIsAssumptionsExpanded(detail.expanded)}
                >
                  <Assumptions
                    assumptions={assumptions}
                    onUpdateAssumptions={updateAssumptions}
                  />
                </ExpandableSection>
              </Container>

              {calculationError && (
                <Alert type="error" header="计算错误" dismissible onDismiss={() => setCalculationError(null)}>
                  {calculationError}
                </Alert>
              )}

              {results && (
                <Container>
                  <ExpandableSection
                    headerText="成本分析"
                    variant="container"
                    expanded={isResultsExpanded}
                    onChange={({ detail }) => setIsResultsExpanded(detail.expanded)}
                  >
                    <Results
                      results={results}
                      currency={selectedCurrency}
                      exchangeRate={exchangeRate}
                    />
                  </ExpandableSection>
                </Container>
              )}
            </SpaceBetween>
          </SpaceBetween>
        </Container>
      }
    />
  );
}

export default App;
