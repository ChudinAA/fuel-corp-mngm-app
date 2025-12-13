
import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertWarehouseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";
import { sql } from "drizzle-orm";

export function registerWarehousesOperationsRoutes(app: Express) {
  app.get("/api/warehouses", requireAuth, async (req, res) => {
    const data = await storage.warehouses.getAllWarehouses();
    res.json(data);
  });

  app.get("/api/warehouses/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const warehouse = await storage.warehouses.getWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ message: "Склад не найден" });
    }
    res.json(warehouse);
  });

  app.post("/api/warehouses", requireAuth, async (req, res) => {
    try {
      const { createSupplier, ...warehouseData } = req.body;
      const data = insertWarehouseSchema.parse({
        ...warehouseData,
        createdById: req.session.userId,
      });
      const item = await storage.warehouses.createWarehouse(data);
      
      // Automatically create supplier if requested
      if (createSupplier && data.baseIds && data.baseIds.length > 0) {
        const supplierData = {
          name: data.name,
          baseIds: data.baseIds,
          isWarehouse: true,
          storageCost: data.storageCost || null,
          isActive: data.isActive ?? true,
          createdById: req.session.userId,
        };
        
        const supplier = await storage.suppliers.createSupplier(supplierData);
        await storage.warehouses.updateWarehouse(item.id, {
          supplierId: supplier.id,
          updatedAt: sql`NOW()`,
          updatedById: req.session.userId,
        });
      }
      
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания склада" });
    }
  });

  app.patch("/api/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.warehouses.updateWarehouse(id, {
        ...req.body,
        updatedById: req.session.userId,
      });
      if (!item) {
        return res.status(404).json({ message: "Склад не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления склада" });
    }
  });

  app.delete("/api/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      
      // Get warehouse to check if it's linked to a supplier
      const warehouse = await storage.warehouses.getWarehouse(id);
      // Only update supplier if warehouse is active
      if (warehouse?.supplierId && warehouse?.isActive) {
        // Update supplier to set isWarehouse = false
        await storage.suppliers.updateSupplier(warehouse.supplierId, {
          isWarehouse: false,
          storageCost: null,
        });
      }
      
      await storage.warehouses.deleteWarehouse(id);
      res.json({ message: "Склад удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления склада" });
    }
  });

  app.get("/api/warehouses/:id/transactions", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const transactions = await storage.warehouses.getWarehouseTransactions(id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения транзакций склада" });
    }
  });
}
