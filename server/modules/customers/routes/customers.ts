import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertCustomerSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerCustomersRoutes(app: Express) {
  app.get(
    "/api/customers",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      const module = req.query.module as string | undefined;
      const data = await storage.customers.getAllCustomers(module);
      res.json(data);
    }
  );

  app.get(
    "/api/customers/:id",
    requireAuth,
    requirePermission("directories", "view"),
    auditView(ENTITY_TYPES.CUSTOMER),
    async (req, res) => {
      const id = req.params.id;
      const customer = await storage.customers.getCustomer(id);
      if (!customer) {
        return res.status(404).json({ message: "Покупатель не найден" });
      }
      res.json(customer);
    }
  );

  app.post(
    "/api/customers",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.CUSTOMER,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertCustomerSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.customers.createCustomer(data);
        res.status(201).json(item);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка создания покупателя" });
      }
    }
  );

  app.patch(
    "/api/customers/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.CUSTOMER,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.customers.getCustomer(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.customers.updateCustomer(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Покупатель не найден" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления покупателя" });
      }
    }
  );

  app.delete(
    "/api/customers/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.CUSTOMER,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.customers.getCustomer(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.customers.deleteCustomer(id, req.session.userId);
        res.json({ message: "Покупатель удален" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления покупателя" });
      }
    }
  );
}
