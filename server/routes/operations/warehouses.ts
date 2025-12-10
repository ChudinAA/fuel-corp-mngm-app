
import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertWarehouseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerWarehousesOperationsRoutes(app: Express) {
  app.get("/api/warehouses", requireAuth, async (req, res) => {
    const data = await storage.operations.getAllWarehouses();
    res.json(data);
  });

  app.get("/api/warehouses/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const warehouse = await storage.operations.getWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ message: "Склад не найден" });
    }
    res.json(warehouse);
  });

  app.post("/api/warehouses", requireAuth, async (req, res) => {
    try {
      const { createSupplier, supplierType, ...warehouseData } = req.body;
      const data = insertWarehouseSchema.parse(warehouseData);
      const item = await storage.operations.createWarehouse(data);
      
      // Automatically create supplier if requested
      if (createSupplier && supplierType && data.baseIds && data.baseIds.length > 0) {
        const supplierData = {
          name: data.name,
          baseIds: data.baseIds,
          isWarehouse: true,
          storageCost: data.storageCost || null,
          isActive: data.isActive ?? true,
        };
        
        if (supplierType === "wholesale") {
          const supplier = await storage.wholesale.createWholesaleSupplier(supplierData);
          await storage.operations.updateWarehouse(item.id, {
            supplierType: "wholesale",
            supplierId: supplier.id,
          });
        } else if (supplierType === "refueling") {
          const supplier = await storage.refueling.createRefuelingProvider(supplierData);
          await storage.operations.updateWarehouse(item.id, {
            supplierType: "refueling",
            supplierId: supplier.id,
          });
        }
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
      const item = await storage.operations.updateWarehouse(id, req.body);
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
      const warehouse = await storage.operations.getWarehouse(id);
      if (warehouse?.supplierId && warehouse?.supplierType) {
        // Update supplier to set isWarehouse = false
        if (warehouse.supplierType === "wholesale") {
          await storage.wholesale.updateWholesaleSupplier(warehouse.supplierId, {
            isWarehouse: false,
            storageCost: null,
          });
        } else if (warehouse.supplierType === "refueling") {
          await storage.refueling.updateRefuelingProvider(warehouse.supplierId, {
            isWarehouse: false,
            storageCost: null,
          });
        }
      }
      
      await storage.operations.deleteWarehouse(id);
      res.json({ message: "Склад удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления склада" });
    }
  });

  app.get("/api/warehouses/:id/transactions", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const transactions = await storage.operations.getWarehouseTransactions(id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Ошибка получения транзакций склада" });
    }
  });
}
