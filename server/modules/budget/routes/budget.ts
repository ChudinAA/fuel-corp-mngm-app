
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertBudgetIncomeExpenseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { AUDIT_OPERATIONS, ENTITY_TYPES } from "../../audit/entities/audit";
import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

class InvalidBudgetVolumeError extends Error {}

function storedKilogramsToTonnes(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const kilograms = Number(value);
  if (!Number.isFinite(kilograms)) {
    throw new TypeError("Budget sales volume must be a finite kilogram value");
  }
  return kilogramsToTonnes(kilograms);
}

function storedTonnesToApi(
  tonnes: string | null | undefined,
  legacyKilograms: string | null | undefined,
): number | null {
  if (tonnes == null || tonnes.trim() === "") {
    return storedKilogramsToTonnes(legacyKilograms);
  }
  const parsedTonnes = Number(tonnes);
  if (!Number.isFinite(parsedTonnes)) {
    throw new TypeError("Budget sales volume must be a finite tonne value");
  }
  return parsedTonnes;
}

function budgetEntryToApi<T extends {
  salesVolume?: string | null;
  salesVolumeTonnes?: string | null;
}>(entry: T) {
  const { salesVolume, salesVolumeTonnes, ...fields } = entry;
  return {
    ...fields,
    salesVolumeTonnes: storedTonnesToApi(salesVolumeTonnes, salesVolume),
  };
}

function budgetInputToStored(data: Record<string, unknown>) {
  const { salesVolumeTonnes, salesVolume, ...fields } = data;
  if (salesVolumeTonnes !== undefined) {
    if (salesVolumeTonnes === null || salesVolumeTonnes === "") {
      return { ...fields, salesVolume: null, salesVolumeTonnes: null };
    }

    const rawTonnes = Number(salesVolumeTonnes);
    if (!Number.isFinite(rawTonnes) || rawTonnes < 0) {
      throw new InvalidBudgetVolumeError("Объем продаж должен быть неотрицательным значением в тоннах");
    }

    const tonnes = Number(rawTonnes.toFixed(5));
    const kilograms = Number(tonnesToKilograms(tonnes).toFixed(2));
    return {
      ...fields,
      salesVolume: String(kilograms),
      salesVolumeTonnes: tonnes.toFixed(5),
    };
  }

  if (salesVolume === undefined) return fields;
  if (salesVolume === null || String(salesVolume).trim() === "") {
    return { ...fields, salesVolume: null, salesVolumeTonnes: null };
  }

  const rawKilograms = Number(salesVolume);
  if (!Number.isFinite(rawKilograms) || rawKilograms < 0) {
    throw new InvalidBudgetVolumeError("Объем продаж должен быть неотрицательным значением");
  }
  const tonnes = Number((rawKilograms / 1000).toFixed(5));
  const kilograms = Number(tonnesToKilograms(tonnes).toFixed(2));
  return {
    ...fields,
    salesVolume: String(kilograms),
    salesVolumeTonnes: tonnes.toFixed(5),
  };
}

export function registerBudgetRoutes(app: Express) {
  // Get budget entries
  app.get(
    "/api/budget",
    requireAuth,
    requirePermission("budget", "view"),
    async (req, res) => {
      try {
        const filters = {
          startMonth: req.query.startMonth as string | undefined,
          endMonth: req.query.endMonth as string | undefined,
        };
        const entries = await storage.budget.getBudgetEntries(filters);
        res.json(entries.map(budgetEntryToApi));
      } catch (error) {
        console.error("Error fetching budget entries:", error);
        res.status(500).json({ message: "Ошибка получения записей БДР" });
      }
    }
  );

  // Get single budget entry
  app.get(
    "/api/budget/:id",
    requireAuth,
    requirePermission("budget", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const entry = await storage.budget.getBudgetEntry(id);
        if (!entry) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(budgetEntryToApi(entry));
      } catch (error) {
        console.error("Error fetching budget entry:", error);
        res.status(500).json({ message: "Ошибка получения записи" });
      }
    }
  );

  // Create budget entry
  app.post(
    "/api/budget",
    requireAuth,
    requirePermission("budget", "create"),
    async (req, res) => {
      try {
        const data = insertBudgetIncomeExpenseSchema.parse({
          ...budgetInputToStored(req.body),
          createdById: req.session.userId,
        });


  // Auto-fill budget from sales data
  app.post("/api/budgets/:id/auto-fill", requireAuth, requirePermission("reports", "edit"), auditLog({ entityType: ENTITY_TYPES.BUDGET, operation: AUDIT_OPERATIONS.UPDATE }), async (req, res) => {
    try {
      const result = await storage.budget.autoFillFromSales(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calculate budget metrics
  app.get("/api/budgets/:id/metrics", requireAuth, requirePermission("reports", "view"), async (req, res) => {
    try {
      const metrics = await storage.budget.calculateBudgetMetrics(req.params.id);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

        const entry = await storage.budget.createBudgetEntry(data);
        res.status(201).json(budgetEntryToApi(entry));
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error instanceof InvalidBudgetVolumeError) {
          return res.status(400).json({ message: error.message });
        }
        console.error("Error creating budget entry:", error);
        res.status(500).json({ message: "Ошибка создания записи" });
      }
    }
  );

  // Update budget entry
  app.patch(
    "/api/budget/:id",
    requireAuth,
    requirePermission("budget", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const entry = await storage.budget.updateBudgetEntry(id, {
          ...budgetInputToStored(req.body),
          updatedById: req.session.userId,
        });
        if (!entry) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(budgetEntryToApi(entry));
      } catch (error) {
        if (error instanceof InvalidBudgetVolumeError) {
          return res.status(400).json({ message: error.message });
        }
        console.error("Error updating budget entry:", error);
        res.status(500).json({ message: "Ошибка обновления записи" });
      }
    }
  );

  // Auto-fill budget from sales data
  app.post(
    "/api/budget/:id/auto-fill",
    requireAuth,
    requirePermission("budget", "edit"),
    async (req, res) => {
      try {
        const result = await storage.budget.autoFillFromSales(req.params.id);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  // Calculate budget metrics
  app.get(
    "/api/budget/:id/metrics",
    requireAuth,
    requirePermission("budget", "view"),
    async (req, res) => {
      try {
        const metrics = await storage.budget.calculateBudgetMetrics(req.params.id);
        res.json(metrics);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  // Update budget from sales data
  app.post(
    "/api/budget/update-from-sales",
    requireAuth,
    requirePermission("budget", "edit"),
    async (req, res) => {
      try {
        const { budgetMonth } = req.body;
        if (!budgetMonth) {
          return res.status(400).json({ message: "Не указан месяц бюджета" });
        }
        const entry = await storage.budget.updateBudgetFromSales(budgetMonth);
        if (!entry) {
          return res.status(404).json({ message: "Запись для обновления не найдена" });
        }
        res.json(budgetEntryToApi(entry));
      } catch (error) {
        console.error("Error updating budget from sales:", error);
        res.status(500).json({ message: "Ошибка обновления данных БДР" });
      }
    }
  );

  // Delete budget entry
  app.delete(
    "/api/budget/:id",
    requireAuth,
    requirePermission("budget", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.budget.deleteBudgetEntry(id, req.session.userId);
        res.json({ message: "Запись удалена" });
      } catch (error) {
        console.error("Error deleting budget entry:", error);
        res.status(500).json({ message: "Ошибка удаления записи" });
      }
    }
  );
}
