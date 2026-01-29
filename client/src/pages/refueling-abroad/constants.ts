import { PRODUCT_TYPE } from "@shared/constants";

export const PRODUCT_TYPES_ABROAD = [
  { value: PRODUCT_TYPE.KEROSENE, label: "Керосин" },
  { value: PRODUCT_TYPE.PVKJ, label: "ПВКЖ" },
  { value: PRODUCT_TYPE.SERVICE, label: "Услуга заправки" },
] as const;