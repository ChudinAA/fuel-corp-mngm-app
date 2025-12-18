import { ENTITY_TYPE } from "@shared/constants";

export const formatNumber = (value: string | number | null) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

export const getEntitiesByType = (
  type: string,
  allBases: any[] = [],
  warehouses: any[] = [],
  deliveryLocations: any[] = []
) => {
  switch (type) {
    case ENTITY_TYPE.BASE:
      return allBases;
    case ENTITY_TYPE.WAREHOUSE:
      return warehouses;
    case ENTITY_TYPE.DELIVERY_LOCATION:
      return deliveryLocations;
    default:
      return [];
  }
};
