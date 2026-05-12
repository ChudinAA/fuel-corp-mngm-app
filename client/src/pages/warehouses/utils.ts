
export const formatNumber = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
};

export const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { 
    style: 'currency', 
    currency: 'RUB', 
    maximumFractionDigits: 2 
  }).format(num);
};

// For per-kg cost/price — up to 6 decimal places, no trailing zeros
export const formatCost = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
};

export const getTransactionTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    receipt: "Поступление",
    sale: "Продажа (ОПТ)",
    refueling: "Заправка ВС",
    transfer_in: "Перемещение (приход)",
    transfer_out: "Перемещение (расход)",
  };
  return types[type] || type;
};
