// Supported currencies for the calculator
// Exchange rates are approximate mid-market rates as of May 26, 2026
// Base currency is USD (all Huawei Cloud ECS pricing is normalized to USD base)

export const currencies = [
  { label: 'USD - US Dollar ($)', value: 'USD', symbol: '$', rate: 1.0 },
  { label: 'EUR - Euro (€)', value: 'EUR', symbol: '€', rate: 0.86 },
  { label: 'GBP - British Pound (£)', value: 'GBP', symbol: '£', rate: 0.74 },
  { label: 'JPY - Japanese Yen (¥)', value: 'JPY', symbol: '¥', rate: 157.00 },
  { label: 'CNY - Chinese Yuan (¥)', value: 'CNY', symbol: '¥', rate: 6.81 },
  { label: 'INR - Indian Rupee (₹)', value: 'INR', symbol: '₹', rate: 96.31 },
  { label: 'AUD - Australian Dollar (A$)', value: 'AUD', symbol: 'A$', rate: 1.40 },
  { label: 'CAD - Canadian Dollar (C$)', value: 'CAD', symbol: 'C$', rate: 1.38 },
  { label: 'SGD - Singapore Dollar (S$)', value: 'SGD', symbol: 'S$', rate: 1.28 },
  { label: 'BRL - Brazilian Real (R$)', value: 'BRL', symbol: 'R$', rate: 4.97 }
];

export const defaultCurrency = 'USD';

// Helper function to get currency by code
export const getCurrency = (code) => {
  return currencies.find(c => c.value === code) || currencies[0];
};

// Helper function to convert amount from USD to target currency
export const convertCurrency = (amountUSD, targetCurrencyCode) => {
  const currency = getCurrency(targetCurrencyCode);
  return amountUSD * currency.rate;
};

// Helper function to format currency with proper symbol and decimals
export const formatCurrency = (amount, currencyCode) => {
  const currency = getCurrency(currencyCode);
  
  // For JPY and other currencies without decimal places
  const decimals = ['JPY', 'KRW'].includes(currencyCode) ? 0 : 2;
  
  return `${currency.symbol}${amount.toFixed(decimals)}`;
};
