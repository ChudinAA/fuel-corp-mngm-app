import type { Express } from "express";
import { storage } from "../../../storage/index";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerWarehousesOperationsRoutes(app: Express) {
  app.get(
    "/api/warehouses",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      const data = await storage.warehouses.getAllWarehouses();
      res.json(data);
    }
  );

  app.get(
    "/api/warehouses/:id",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      const id = req.params.id;
      const warehouse = await storage.warehouses.getWarehouse(id);
      if (!warehouse) {
        return res.status(404).json({ message: "Склад не найден" });
      }
      res.json(warehouse);
    }
  );

  app.post(
    "/api/warehouses",
    requireAuth,
    requirePermission("warehouses", "create"),
    async (req, res) => {
      try {
        const { createSupplier, bases, ...warehouseData } = req.body;

        // Extract baseIds from bases array or use empty array
        const baseIds = Array.isArray(bases)
          ? bases.map((b: { baseId: string }) => b.baseId).filter(Boolean)
          : [];

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
            updatedById: req.session.userId,
          });
        }

        res.status(201).json(item);
      } catch (error) {
        console.error("Warehouse creation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res
          .status(500)
          .json({ message: "Ошибка создания склада", error: error.message });
      }
    }
  );

  app.patch(
    "/api/warehouses/:id",
    requireAuth,
    requirePermission("warehouses", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const { bases, ...warehouseData } = req.body;

        // Extract baseIds from bases array if provided
        const updateData: any = {
          ...warehouseData,
          updatedById: req.session.userId,
        };

        // Convert empty strings to null for numeric fields
        if (updateData.storageCost === "") {
          updateData.storageCost = null;
        }
        if (updateData.pvkjBalance === "") {
          updateData.pvkjBalance = null;
        }
        if (updateData.pvkjAverageCost === "") {
          updateData.pvkjAverageCost = null;
        }

        if (bases !== undefined) {
          updateData.baseIds = Array.isArray(bases)
            ? bases.map((b: { baseId: string }) => b.baseId).filter(Boolean)
            : [];
        }

        const item = await storage.warehouses.updateWarehouse(id, updateData);
        if (!item) {
          return res.status(404).json({ message: "Склад не найден" });
        }
        res.json(item);
      } catch (error) {
        console.error("Warehouse update error:", error);
        res.status(500).json({ message: "Ошибка обновления склада" });
      }
    }
  );

  app.delete(
    "/api/warehouses/:id",
    requireAuth,
    requirePermission("warehouses", "delete"),
    async (req, res) => {
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
            console.error(
              "Error updating supplier during warehouse deletion:",
              supplierError
            );
            // Continue with warehouse deletion even if supplier update fails
          }
        }

        await storage.warehouses.deleteWarehouse(id);
        res.json({ message: "Склад удален" });
      } catch (error) {
        console.error("Warehouse deletion error:", error);
        res
          .status(500)
          .json({ message: "Ошибка удаления склада", error: error.message });
      }
    }
  );

  app.get(
    "/api/warehouses/:id/transactions",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const transactions = await storage.warehouses.getWarehouseTransactions(
          id
        );
        res.json(transactions);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения транзакций склада" });
      }
    }
  );
}
