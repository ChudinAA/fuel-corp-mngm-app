
export const formatNumber = (value: string | number | null) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

export const getEntitiesByType = (
  type: string,
  bases: any[] = [],
  warehouses: any[] = [],
  deliveryLocations: any[] = []
) => {
  switch (type) {
    case "base":
      return bases;
    case "warehouse":
      return warehouses;
    case "delivery_location":
      return deliveryLocations;
    default:
      return [];
  }
};
