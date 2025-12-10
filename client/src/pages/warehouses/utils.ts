
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
