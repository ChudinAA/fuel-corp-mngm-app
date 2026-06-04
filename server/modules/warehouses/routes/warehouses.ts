import type { Express } from "express";
import { storage } from "../../../storage/index";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { PRODUCT_TYPE, TRANSACTION_TYPE } from "@shared/constants";
import { SSEService } from "../../../services/sse-service";
import { db } from "../../../db";
import { warehouses } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { RecalculationQueueService } from "../services/recalculation-queue-service";
import { format } from "date-fns";

export function registerWarehousesOperationsRoutes(app: Express) {
  app.get(
    "/api/warehouses",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      const data = await storage.warehouses.getAllWarehouses();
      res.json(data);
    },
  );

  // Must be registered BEFORE /api/warehouses/:id to avoid "lik" being parsed as UUID
  app.get(
    "/api/warehouses/lik",
    requireAuth,
    async (req, res) => {
      try {
        const allowedIds = await storage.warehouses.getUserAllowedLikWarehouseIds(
          req.session.userId as unknown as string,
        );
        const data = await storage.warehouses.getLikWarehouses(allowedIds);
        res.json(data);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения складов ОП" });
      }
    },
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
    },
  );

  app.post(
    "/api/warehouses",
    requireAuth,
    requirePermission("warehouses", "create"),
    auditLog({
      entityType: ENTITY_TYPES.WAREHOUSE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const {
          supplierLinkMode,
          linkedSupplierId,
          newSupplierData,
          createSupplier,
          bases,
          services,
          ...warehouseData
        } = req.body;

        const baseIds = Array.isArray(bases)
          ? bases.map((b: { baseId: string }) => b.baseId).filter(Boolean)
          : [];

        const parsedServices = Array.isArray(services)
          ? services.filter((s: any) => s.serviceType && s.serviceValue)
          : [];

        const data = {
          ...warehouseData,
          baseIds,
          services: parsedServices,
          createdById: req.session.userId,
          supplierId: warehouseData.supplierId || null,
          storageCost:
            warehouseData.storageCost === "" ? null : warehouseData.storageCost,
          isExport: warehouseData.isExport ?? false,
        };

        const item = await storage.warehouses.createWarehouse(data);

        // Determine effective link mode (support both new and legacy field)
        const effectiveLinkMode = supplierLinkMode || (createSupplier ? "create" : "none");

        if (effectiveLinkMode === "link" && linkedSupplierId) {
          // Link existing supplier
          try {
            const targetSupplier = await storage.suppliers.getSupplier(linkedSupplierId);
            if (targetSupplier?.warehouseId && targetSupplier.warehouseId !== item.id) {
              // Supplier already linked, just skip silently or log
              console.warn("Supplier already linked to another warehouse, skipping");
            } else {
              await storage.warehouses.updateWarehouse(item.id, {
                supplierId: linkedSupplierId,
                updatedById: req.session.userId ? String(req.session.userId) : null,
              } as any);
              await storage.suppliers.updateSupplier(linkedSupplierId, {
                isWarehouse: true,
                warehouseId: item.id,
              });
            }
          } catch (e) {
            console.error("Failed to link supplier for warehouse:", e);
          }
        } else if (effectiveLinkMode === "create") {
          // Create new supplier and link
          try {
            const supplierName = newSupplierData?.name || data.name;
            const supplierData: any = {
              name: supplierName,
              fullName: newSupplierData?.fullName || null,
              inn: newSupplierData?.inn || null,
              baseIds: baseIds,
              isWarehouse: true,
              warehouseId: item.id,
              storageCost: data.storageCost || null,
              isActive: true,
              createdById: req.session.userId ? String(req.session.userId) : null,
            };

            const supplier = await storage.suppliers.createSupplier(supplierData);
            await storage.warehouses.updateWarehouse(item.id, {
              supplierId: supplier.id,
              updatedById: req.session.userId ? String(req.session.userId) : null,
            } as any);
          } catch (suppError: any) {
            console.error("Failed to auto-create supplier for warehouse:", suppError);
          }
        }

        res.status(201).json(item);
      } catch (error: any) {
        console.error("Warehouse creation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res
          .status(500)
          .json({ message: "Ошибка создания склада", error: error.message });
      }
    },
  );

  app.patch(
    "/api/warehouses/:id",
    requireAuth,
    requirePermission("warehouses", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.WAREHOUSE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.warehouses.getWarehouse(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const {
          supplierLinkMode,
          linkedSupplierId,
          newSupplierData,
          bases,
          services,
          ...warehouseData
        } = req.body;

        const updateData: any = {
          ...warehouseData,
          updatedById: req.session.userId,
        };

        if (updateData.storageCost === "") updateData.storageCost = null;
        if (updateData.pvkjBalance === "") updateData.pvkjBalance = null;
        if (updateData.pvkjAverageCost === "") updateData.pvkjAverageCost = null;

        if (bases !== undefined) {
          updateData.baseIds = Array.isArray(bases)
            ? bases.map((b: { baseId: string }) => b.baseId).filter(Boolean)
            : [];
        }

        if (services !== undefined) {
          updateData.services = Array.isArray(services)
            ? services.filter((s: any) => s.serviceType && s.serviceValue)
            : [];
        }

        // Handle supplier linking actions
        if (supplierLinkMode === "link" && linkedSupplierId) {
          // Check supplier is not already linked to another warehouse
          const targetSupplier = await storage.suppliers.getSupplier(linkedSupplierId);
          if (targetSupplier?.warehouseId && targetSupplier.warehouseId !== id) {
            return res.status(400).json({ message: "Этот поставщик уже привязан к другому складу" });
          }
          // Unlink old supplier if different
          const current = await storage.warehouses.getWarehouse(id);
          if (current?.supplierId && current.supplierId !== linkedSupplierId) {
            await storage.suppliers.updateSupplier(current.supplierId, {
              isWarehouse: false,
              warehouseId: null,
            });
          }
          updateData.supplierId = linkedSupplierId;
          await storage.suppliers.updateSupplier(linkedSupplierId, {
            isWarehouse: true,
            warehouseId: id,
          });
        } else if (supplierLinkMode === "unlink") {
          const current = await storage.warehouses.getWarehouse(id);
          if (current?.supplierId) {
            await storage.suppliers.updateSupplier(current.supplierId, {
              isWarehouse: false,
              warehouseId: null,
            });
          }
          updateData.supplierId = null;
        } else if (supplierLinkMode === "create" && newSupplierData) {
          // Unlink old supplier first
          const current = await storage.warehouses.getWarehouse(id);
          if (current?.supplierId) {
            await storage.suppliers.updateSupplier(current.supplierId, {
              isWarehouse: false,
              warehouseId: null,
            });
          }
          const warehouseBaseIds = updateData.baseIds || current?.baseIds || [];
          const supplier = await storage.suppliers.createSupplier({
            name: newSupplierData.name,
            fullName: newSupplierData.fullName || null,
            inn: newSupplierData.inn || null,
            baseIds: warehouseBaseIds,
            isWarehouse: true,
            warehouseId: id,
            isActive: true,
            createdById: req.session.userId,
          } as any);
          updateData.supplierId = supplier.id;
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
    },
  );

  app.delete(
    "/api/warehouses/:id",
    requireAuth,
    requirePermission("warehouses", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.WAREHOUSE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.warehouses.getWarehouse(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;

        const warehouse = await storage.warehouses.getWarehouse(id);

        if (!warehouse) {
          return res.status(404).json({ message: "Склад не найден" });
        }

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
              supplierError,
            );
          }
        }

        await storage.warehouses.deleteWarehouse(
          id,
          req.session.userId ? String(req.session.userId) : undefined,
        );
        res.json({ message: "Склад удален" });
      } catch (error: any) {
        console.error("Warehouse deletion error:", error);
        res
          .status(500)
          .json({
            message: "Ошибка удаления склада",
            error: error?.message || String(error),
          });
      }
    },
  );

  // ===== PIN WAREHOUSE =====
  app.patch(
    "/api/warehouses/:id/pin",
    requireAuth,
    requirePermission("warehouses", "edit"),
    async (req, res) => {
      try {
        const warehouseId = req.params.id;
        const { isPinned } = req.body;
        const userId = req.session.userId ? String(req.session.userId) : undefined;

        await db
          .update(warehouses)
          .set({
            isPinned: isPinned ?? true,
            updatedAt: sql`NOW()`,
            updatedById: userId,
          })
          .where(eq(warehouses.id, warehouseId));

        const updated = await storage.warehouses.getWarehouse(warehouseId);
        if (!updated) return res.status(404).json({ message: "Склад не найден" });
        res.json(updated);
      } catch (error: any) {
        console.error("Pin warehouse error:", error);
        res.status(500).json({ message: "Ошибка закрепления склада", error: error.message });
      }
    },
  );

  // ===== SET LIMIT =====
  app.post(
    "/api/warehouses/:id/set-limit",
    requireAuth,
    requirePermission("warehouses", "edit"),
    async (req, res) => {
      try {
        const warehouseId = req.params.id;
        const { limitVolume, limitProductType } = req.body;
        const userId = req.session.userId ? String(req.session.userId) : undefined;

        let limitExpiresAt: string | null = null;
        if (limitVolume) {
          const now = new Date();
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          limitExpiresAt = format(nextMonth, "yyyy-MM-dd");
        }

        await db
          .update(warehouses)
          .set({
            limitVolume: limitVolume ? String(limitVolume) : null,
            limitProductType: limitVolume ? (limitProductType || PRODUCT_TYPE.KEROSENE) : null,
            limitExpiresAt: limitExpiresAt,
            updatedAt: sql`NOW()`,
            updatedById: userId,
          })
          .where(eq(warehouses.id, warehouseId));

        const updated = await storage.warehouses.getWarehouse(warehouseId);
        if (!updated) return res.status(404).json({ message: "Склад не найден" });
        res.json(updated);
      } catch (error: any) {
        console.error("Set limit error:", error);
        res.status(500).json({ message: "Ошибка установки лимита", error: error.message });
      }
    },
  );

  // ===== INVENTORY =====
  app.post(
    "/api/warehouses/:id/inventory",
    requireAuth,
    requirePermission("warehouses", "edit"),
    async (req, res) => {
      try {
        const warehouseId = req.params.id;
        const { productType, targetDate, targetBalance, targetAverageCost } = req.body;
        const userId = req.session.userId ? String(req.session.userId) : undefined;

        if (!productType || !targetDate || targetBalance === undefined || targetAverageCost === undefined) {
          return res.status(400).json({ message: "Не указаны обязательные параметры" });
        }

        const result = await storage.warehouses.createInventoryTransaction({
          warehouseId,
          productType,
          targetDate,
          targetBalance: parseFloat(targetBalance),
          targetAverageCost: parseFloat(targetAverageCost),
          userId,
        });

        const txDate = format(
          new Date(new Date(targetDate).setHours(23, 59, 0, 0)),
          "yyyy-MM-dd'T'HH:mm:ss",
        );

        await RecalculationQueueService.addToQueue(
          warehouseId,
          productType,
          txDate,
          userId,
          1,
        );

        res.json(result);
      } catch (error: any) {
        console.error("Inventory error:", error);
        res.status(500).json({ message: "Ошибка инвентаризации", error: error.message });
      }
    },
  );

  app.get(
    "/api/warehouses/:id/transactions",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const result = await storage.warehouses.getWarehouseTransactions(
          id,
          limit,
          offset,
        );
        res.json(result);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ message: "Ошибка получения транзакций склада" });
      }
    },
  );

  app.get(
    "/api/warehouses/:id/monthly-stats",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = await storage.warehouses.getWarehouseMonthlyStats(
          id,
          startOfMonth,
        );
        res.json(stats);
      } catch (error) {
        console.error("Error calculating monthly stats:", error);
        res.status(500).json({ message: "Ошибка получения статистики склада" });
      }
    },
  );

  app.get(
    "/api/warehouses/:id/balance",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const dateStr = req.query.date as string;
        const productType =
          (req.query.productType as string) || PRODUCT_TYPE.KEROSENE;
        if (!dateStr) {
          return res.status(400).json({ message: "Дата не указана" });
        }
        const date = new Date(dateStr);
        const balanceData = await storage.warehouses.getWarehouseBalanceAtDate(
          id,
          date,
          productType,
        );
        res.json(balanceData);
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения остатка склада" });
      }
    },
  );

  app.get(
    "/api/warehouses/:id/equipment",
    requireAuth,
    requirePermission("warehouses", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const equipment = await storage.equipment.getEquipmentsByWarehouse(id);
        res.json(equipment);
      } catch (error: any) {
        console.error("Error fetching warehouse equipment:", error);
        res
          .status(500)
          .json({
            message: "Ошибка получения оборудования склада",
            error: error.message,
          });
      }
    },
  );

  // ============ USER WAREHOUSE ACCESS (admin) ============

  app.get(
    "/api/admin/users/:userId/warehouse-access",
    requireAuth,
    requirePermission("admin", "view"),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const rows = await storage.warehouses.getUserWarehouseAccess(userId);
        res.json(rows.map((r) => r.warehouseId));
      } catch (error) {
        res.status(500).json({ message: "Ошибка получения доступа к складам" });
      }
    },
  );

  app.put(
    "/api/admin/users/:userId/warehouse-access",
    requireAuth,
    requirePermission("admin", "edit"),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const schema = z.object({
          warehouseIds: z.array(z.string().uuid()),
        });
        const { warehouseIds } = schema.parse(req.body);
        await storage.warehouses.setUserWarehouseAccess(
          userId,
          warehouseIds,
          req.session.userId as unknown as string,
        );
        res.json({ message: "Доступ к складам обновлён" });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        res.status(500).json({ message: "Ошибка обновления доступа к складам" });
      }
    },
  );

  app.get("/api/warehouses/sse/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (!req.session.userId) {
      res.write('event: auth_error\ndata: {"message":"unauthorized"}\n\n');
      res.end();
      return;
    }

    res.write('data: {"type":"connected"}\n\n');

    SSEService.register(res);

    req.on("close", () => {
      res.end();
    });
  });
}
