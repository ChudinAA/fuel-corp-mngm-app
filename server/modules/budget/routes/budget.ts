
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertBudgetIncomeExpenseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

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
        res.json(entries);
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
        res.json(entry);
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
          ...req.body,
          createdById: req.session.userId,
        });
        const entry = await storage.budget.createBudgetEntry(data);
        res.status(201).json(entry);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
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
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!entry) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(entry);
      } catch (error) {
        console.error("Error updating budget entry:", error);
        res.status(500).json({ message: "Ошибка обновления записи" });
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
        res.json(entry);
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
