import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertSupplierSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";
import { BASE_TYPE } from "@shared/constants";

export function registerSuppliersRoutes(app: Express) {
  app.get("/api/suppliers", requireAuth, requirePermission("directories", "view"), async (req, res) => {
    const data = await storage.suppliers.getAllSuppliers();
    res.json(data);
  });

  app.get("/api/suppliers/:id", requireAuth, requirePermission("directories", "view"), async (req, res) => {
    const id = req.params.id;
    const supplier = await storage.suppliers.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: "Поставщик не найден" });
    }
    res.json(supplier);
  });

  app.post("/api/suppliers", requireAuth, requirePermission("directories", "create"), async (req, res) => {
    try {
      const data = insertSupplierSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });

      // First, create the supplier
      const item = await storage.suppliers.createSupplier({
        ...data,
        warehouseId: data.warehouseId || null,
      });

      // Then create warehouse if supplier is marked as warehouse and doesn't have one
      if (data.isWarehouse && !data.warehouseId && data.baseIds && data.baseIds.length > 0) {
        const warehouse = await storage.warehouses.createWarehouse({
          name: data.name,
          baseIds: data.baseIds,
          supplierId: item.id,
          storageCost: data.storageCost || null,
          isActive: data.isActive ?? true,
          createdById: req.session.userId,
        });

        // Link warehouse back to supplier
        await storage.suppliers.updateSupplier(item.id, {
          warehouseId: warehouse.id,
        });
      }

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Ошибка создания поставщика" });
    }
  });

  app.patch("/api/suppliers/:id", requireAuth, requirePermission("directories", "edit"), async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.suppliers.updateSupplier(id, {
        ...req.body,
        updatedById: req.session.userId,
      });
      if (!item) {
        return res.status(404).json({ message: "Поставщик не найден" });
      }
      res.json(item);
    } catch (error) {
      console.error("Supplier update error:", error);
      res.status(500).json({ message: "Ошибка обновления поставщика" });
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, requirePermission("directories", "delete"), async (req, res) => {
    try {
      const id = req.params.id;

      // Check if supplier has a warehouse
      const supplier = await storage.suppliers.getSupplier(id);
      if (supplier?.warehouseId) {
        await storage.warehouses.updateWarehouse(supplier.warehouseId, {
          isActive: false,
        });
      }

      await storage.suppliers.deleteSupplier(id);
      res.json({ message: "Поставщик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления поставщика" });
    }
  });
}