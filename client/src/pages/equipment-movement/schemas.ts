import { z } from "zod";
import { insertMovementSchema, insertEquipmentSchema } from "@shared/schema";

export const equipmentMovementFormSchema = z
  .object({
    movementDate: z.date({ required_error: "Укажите дату" }).describe("Дата операции"),
    movementType: z.string().min(1, "Выберите тип перемещения").describe("Тип операции"),
    productType: z.string().min(1, "Выберите продукт").describe("Тип топлива"),
    nomenclatureId: z.string().optional().nullable().describe("Номенклатура"),
    fromWarehouseId: z.string().optional().nullable().describe("Склад-источник"),
    toWarehouseId: z.string().optional().nullable().describe("Склад-получатель"),
    fromEquipmentId: z.string().optional().nullable().describe("Оборудование-источник"),
    toEquipmentId: z.string().optional().nullable().describe("Оборудование-получатель"),
    inputMode: z.enum(["liters", "tonnes"]).default("tonnes").describe("Единица ввода"),
    quantityLiters: z.string().optional().describe("Количество (л)"),
    density: z.string().optional().describe("Плотность"),
    quantityTonnes: z.string().optional().describe("Масса (т)"),
    totalCost: z.string().optional().describe("Итоговая стоимость"),
    notes: z.string().optional().describe("Примечания"),
    isDraft: z.boolean().default(false).describe("Черновик"),
  })
  .superRefine((data, ctx) => {
    if (data.inputMode === "tonnes") {
      if (!data.quantityTonnes || Number(data.quantityTonnes) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите массу в тоннах",
          path: ["quantityTonnes"],
        });
      }
    } else {
      if (!data.quantityLiters || Number(data.quantityLiters) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите положительный объём в литрах",
          path: ["quantityLiters"],
        });
      }
      if (!data.density || Number(data.density) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите положительную плотность",
          path: ["density"],
        });
      }
    }
  });

export type EquipmentMovementFormData = z.infer<typeof equipmentMovementFormSchema>;
