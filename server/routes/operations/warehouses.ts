
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
      const { createSupplier, bases, ...warehouseData } = req.body;
      
      // Extract baseIds from bases array
      const baseIds = bases?.map((b: { baseId: string }) => b.baseId).filter(Boolean) || [];
      
      const data = {
        ...warehouseData,
        baseIds,
        createdById: req.session.userId,
        supplierId: warehouseData.supplierId || null,
      };
      
      const item = await storage.warehouses.createWarehouse(data);
      
      // Automatically create supplier if requested
      if (createSupplier && baseIds.length > 0) {
        const supplierData = {
          name: data.name,
          baseIds: baseIds,
          isWarehouse: true,
          warehouseId: item.id,
          storageCost: data.storageCost || null,
          isActive: true,
          createdById: req.session.userId,
        };
        
        const supplier = await storage.suppliers.createSupplier(supplierData);
        await storage.warehouses.updateWarehouse(item.id, {
          supplierId: supplier.id,
          updatedById: req.session.userId
        });
      }
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Warehouse creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания склада", error: error.message });
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
      
      if (!warehouse) {
        return res.status(404).json({ message: "Склад не найден" });
      }
      
      // Update supplier if warehouse is linked to one
      if (warehouse.supplierId) {
        try {
          await storage.suppliers.updateSupplier(warehouse.supplierId, {
            isWarehouse: false,
            warehouseId: null,
            storageCost: null,
          });
        } catch (supplierError) {
          console.error("Error updating supplier during warehouse deletion:", supplierError);
          // Continue with warehouse deletion even if supplier update fails
        }
      }
      
      await storage.warehouses.deleteWarehouse(id);
      res.json({ message: "Склад удален" });
    } catch (error) {
      console.error("Warehouse deletion error:", error);
      res.status(500).json({ message: "Ошибка удаления склада", error: error.message });
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
