import { z } from "zod";
import { insertMovementSchema, insertEquipmentSchema } from "@shared/schema";

export const equipmentMovementFormSchema = z
  .object({
    movementDate: z.date({ required_error: "Укажите дату" }).describe("Дата операции"),
    movementType: z.string().min(1, "Выберите тип перемещения").describe("Тип операции"),
    productType: z.string().min(1, "Выберите продукт").describe("Тип топлива"),
    fromWarehouseId: z.string().optional().nullable().describe("Склад-источник"),
    toWarehouseId: z.string().optional().nullable().describe("Склад-получатель"),
    fromEquipmentId: z.string().optional().nullable().describe("Оборудование-источник"),
    toEquipmentId: z.string().optional().nullable().describe("Оборудование-получатель"),
    inputMode: z.enum(["liters", "kg"]).default("kg").describe("Единица ввода"),
    quantityLiters: z.string().optional().describe("Количество (л)"),
    density: z.string().optional().describe("Плотность"),
    quantityKg: z.string().optional().describe("Количество (кг)"),
    costPerKg: z.string().optional().describe("Цена за кг"),
    totalCost: z.string().optional().describe("Итоговая стоимость"),
    notes: z.string().optional().describe("Примечания"),
    isDraft: z.boolean().default(false).describe("Черновик"),
  })
  .superRefine((data, ctx) => {
    if (data.inputMode === "kg") {
      if (!data.quantityKg || data.quantityKg.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите количество (кг)",
          path: ["quantityKg"],
        });
      }
    } else {
      if (!data.quantityLiters || data.quantityLiters.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите объем в литрах",
          path: ["quantityLiters"],
        });
      }
      if (!data.density || data.density.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите плотность",
          path: ["density"],
        });
      }
    }
  });

export type EquipmentMovementFormData = z.infer<typeof equipmentMovementFormSchema>;
