import { z } from "zod";
import { insertMovementSchema, insertEquipmentSchema } from "@shared/schema";

export const equipmentMovementFormSchema = z
  .object({
    movementDate: z.date({ required_error: "Укажите дату" }),
    movementType: z.string().min(1, "Выберите тип перемещения"),
    productType: z.string().min(1, "Выберите продукт"),
    fromWarehouseId: z.string().optional().nullable(),
    toWarehouseId: z.string().optional().nullable(),
    fromEquipmentId: z.string().optional().nullable(),
    toEquipmentId: z.string().optional().nullable(),
    inputMode: z.enum(["liters", "kg"]).default("kg"),
    quantityLiters: z.string().optional(),
    density: z.string().optional(),
    quantityKg: z.string().optional(),
    costPerKg: z.string().optional(),
    totalCost: z.string().optional(),
    notes: z.string().optional(),
    isDraft: z.boolean().default(false),
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
