import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertSupplierSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission, requireAnyPermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerSuppliersRoutes(app: Express) {
  app.get(
    "/api/suppliers",
    requireAuth,
    requireAnyPermission(["directories", "counterparties"], "view"),
    async (req, res) => {
      const data = await storage.suppliers.getAllSuppliers();
      res.json(data);
    },
  );

  app.get(
    "/api/suppliers/:id",
    requireAuth,
    requireAnyPermission(["directories", "counterparties"], "view"),
    async (req, res) => {
      const id = req.params.id;
      const supplier = await storage.suppliers.getSupplier(id);
      if (!supplier) {
        return res.status(404).json({ message: "Поставщик не найден" });
      }
      res.json(supplier);
    },
  );

  app.post(
    "/api/suppliers",
    requireAuth,
    requireAnyPermission(["directories", "counterparties"], "create"),
    auditLog({
      entityType: ENTITY_TYPES.SUPPLIER,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const {
          baseIds,
          basisPrices,
          warehouseAction,
          warehouseId: targetWarehouseId,
          newWarehouseData,
          ...restData
        } = req.body;

        const normalizedBaseIds = Array.isArray(baseIds) ? baseIds : [];
        const normalizedBasisPrices = Array.isArray(basisPrices) ? basisPrices : [];

        const data = insertSupplierSchema.parse({
          ...restData,
          createdById: req.session.userId,
        });

        const item = await storage.suppliers.createSupplier({
          ...data,
          baseIds: normalizedBaseIds,
          basisPrices: normalizedBasisPrices,
          warehouseId: null,
        });

        // Handle warehouse linking
        if (warehouseAction === "link" && targetWarehouseId) {
          // Link existing warehouse
          const targetWarehouse = await storage.warehouses.getWarehouse(targetWarehouseId);
          if (targetWarehouse?.supplierId && targetWarehouse.supplierId !== item.id) {
            return res.status(400).json({ message: "Этот склад уже привязан к другому поставщику" });
          }
          await storage.suppliers.updateSupplier(item.id, {
            warehouseId: targetWarehouseId,
            isWarehouse: true,
          });
          await storage.warehouses.updateWarehouse(targetWarehouseId, {
            supplierId: item.id,
            updatedById: req.session.userId ? String(req.session.userId) : null,
          } as any);
        } else if (warehouseAction === "create" && newWarehouseData) {
          // Create new warehouse and link
          const warehouse = await storage.warehouses.createWarehouse({
            name: newWarehouseData.name || data.name,
            baseIds: newWarehouseData.baseIds || normalizedBaseIds,
            storageCost: newWarehouseData.storageCost || null,
            supplierId: item.id,
            isActive: data.isActive ?? true,
            createdById: req.session.userId,
          });
          await storage.suppliers.updateSupplier(item.id, {
            warehouseId: warehouse.id,
            isWarehouse: true,
            storageCost: newWarehouseData.storageCost || null,
          });
        } else if (data.isWarehouse && !targetWarehouseId && normalizedBaseIds.length > 0) {
          // Legacy: auto-create warehouse if isWarehouse is true without explicit action
          const warehouse = await storage.warehouses.createWarehouse({
            name: data.name,
            baseIds: normalizedBaseIds,
            supplierId: item.id,
            storageCost: data.storageCost || null,
            isActive: data.isActive ?? true,
            createdById: req.session.userId,
          });
          await storage.suppliers.updateSupplier(item.id, {
            warehouseId: warehouse.id,
          });
        }

        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        console.error("Error creating supplier:", error);
        res.status(500).json({ message: "Ошибка создания поставщика" });
      }
    },
  );

  app.patch(
    "/api/suppliers/:id",
    requireAuth,
    requireAnyPermission(["directories", "counterparties"], "edit"),
    auditLog({
      entityType: ENTITY_TYPES.SUPPLIER,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.suppliers.getSupplier(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const {
          baseIds,
          basisPrices,
          warehouseAction,
          warehouseId: targetWarehouseId,
          newWarehouseData,
          ...restData
        } = req.body;

        const updateData: any = {
          ...restData,
          updatedById: req.session.userId,
        };

        if (baseIds !== undefined) {
          updateData.baseIds = Array.isArray(baseIds) ? baseIds : [];
        }

        if (basisPrices !== undefined) {
          updateData.basisPrices = Array.isArray(basisPrices) ? basisPrices : [];
        }

        // Handle warehouse linking actions
        if (warehouseAction === "link" && targetWarehouseId) {
          // Check warehouse is not already linked to another supplier
          const targetWarehouse = await storage.warehouses.getWarehouse(targetWarehouseId);
          if (targetWarehouse?.supplierId && targetWarehouse.supplierId !== id) {
            return res.status(400).json({ message: "Этот склад уже привязан к другому поставщику" });
          }
          // Unlink old warehouse if different
          const current = await storage.suppliers.getSupplier(id);
          if (current?.warehouseId && current.warehouseId !== targetWarehouseId) {
            await storage.warehouses.updateWarehouse(current.warehouseId, {
              supplierId: null,
              updatedById: req.session.userId ? String(req.session.userId) : null,
            } as any);
          }
          updateData.warehouseId = targetWarehouseId;
          updateData.isWarehouse = true;
          await storage.warehouses.updateWarehouse(targetWarehouseId, {
            supplierId: id,
            updatedById: req.session.userId ? String(req.session.userId) : null,
          } as any);
        } else if (warehouseAction === "unlink") {
          const current = await storage.suppliers.getSupplier(id);
          if (current?.warehouseId) {
            await storage.warehouses.updateWarehouse(current.warehouseId, {
              supplierId: null,
              updatedById: req.session.userId ? String(req.session.userId) : null,
            } as any);
          }
          updateData.warehouseId = null;
          updateData.isWarehouse = false;
        } else if (warehouseAction === "create" && newWarehouseData) {
          // Unlink old warehouse first
          const current = await storage.suppliers.getSupplier(id);
          if (current?.warehouseId) {
            await storage.warehouses.updateWarehouse(current.warehouseId, {
              supplierId: null,
              updatedById: req.session.userId ? String(req.session.userId) : null,
            } as any);
          }
          const warehouseBaseIds = updateData.baseIds || current?.baseIds || [];
          const warehouse = await storage.warehouses.createWarehouse({
            name: newWarehouseData.name,
            baseIds: newWarehouseData.baseIds || warehouseBaseIds,
            storageCost: newWarehouseData.storageCost || null,
            supplierId: id,
            isActive: true,
            createdById: req.session.userId,
          });
          updateData.warehouseId = warehouse.id;
          updateData.isWarehouse = true;
          if (newWarehouseData.storageCost) {
            updateData.storageCost = newWarehouseData.storageCost;
          }
        }

        const item = await storage.suppliers.updateSupplier(id, updateData);
        if (!item) {
          return res.status(404).json({ message: "Поставщик не найден" });
        }
        res.json(item);
      } catch (error) {
        console.error("Supplier update error:", error);
        res.status(500).json({ message: "Ошибка обновления поставщика" });
      }
    },
  );

  app.delete(
    "/api/suppliers/:id",
    requireAuth,
    requireAnyPermission(["directories", "counterparties"], "delete"),
    auditLog({
      entityType: ENTITY_TYPES.SUPPLIER,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.suppliers.getSupplier(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;

        const supplier = await storage.suppliers.getSupplier(id);
        if (supplier?.warehouseId) {
          await storage.warehouses.updateWarehouse(supplier.warehouseId, {
            isActive: false,
          });
        }

        await storage.suppliers.deleteSupplier(id, req.session.userId);
        res.json({ message: "Поставщик удален" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления поставщика" });
      }
    },
  );
}
