import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertAircraftRefuelingSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission, requireAnyPermission } from "../../../middleware/middleware";
import {
  auditLog,
  auditView,
  getAuditContext,
} from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { AuditService } from "../../audit/services/audit-service";
import { SSEService } from "../../../services/sse-service";

const refuelingProductLabel = (type: string) =>
  type === "kerosene" ? "Керосин" : type === "pvkj" ? "ПВКЖ" : type === "service" ? "Услуга" : type;

const getOrderProductSummary = (deals: Array<{ productType: string; quantityKg?: unknown }>) =>
  deals
    .map((deal) => {
      const quantity = Number(deal.quantityKg || 0);
      return `${refuelingProductLabel(deal.productType)}${quantity ? ` — ${quantity} кг` : ""}`;
    })
    .join(", ");

export function registerRefuelingOperationsRoutes(app: Express) {
  app.get(
    "/api/refueling",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "view"),
    async (req, res) => {
      const offset = parseInt(req.query.offset as string) || 0;
      const pageSize = parseInt(req.query.pageSize as string) || 100;
      const equipmentType = req.query.equipmentType as string | undefined;
      const search = req.query.search as string | undefined;

      const filters: Record<string, string[]> = {};
      Object.entries(req.query).forEach(([key, value]) => {
        if (key.startsWith("filter_") && typeof value === "string") {
          const columnId = key.replace("filter_", "");
          filters[columnId] = value.split(",").filter(Boolean);
        }
      });

      // Поддержка диапазона дат из фильтра
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      if (dateFrom) filters["dateFrom"] = [dateFrom];
      if (dateTo) filters["dateTo"] = [dateTo];

      // For LIK refueling, get allowed warehouse IDs for the current user
      let allowedWarehouseIds: string[] | null = null;
      if (equipmentType === "lik") {
        allowedWarehouseIds = await storage.warehouses.getUserAllowedLikWarehouseIds(
          String(req.session.userId),
        );
      }

      const result = await (storage.aircraftRefueling as any).getRefuelings(
        offset,
        pageSize,
        equipmentType,
        search,
        filters,
        allowedWarehouseIds,
      );
      res.json(result);
    }
  );

  app.get(
    "/api/refueling/filter-values",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "view"),
    async (req, res) => {
      try {
        const column = req.query.column as string;
        const q = (req.query.q as string) || "";
        const result = await (storage.aircraftRefueling as any).getFilterValues(column, q);
        res.json(result);
      } catch (err) {
        res.status(500).json([]);
      }
    }
  );

  app.get(
    "/api/refueling/contract-used/:priceId",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "view"),
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const usedVolume = await storage.aircraftRefueling.getUsedVolumeByPrice(priceId);
        res.json({ usedVolume });
      } catch (error) {
        console.error("Error getting used volume:", error);
        res.status(500).json({ message: "Ошибка получения использованного объема" });
      }
    }
  );

  app.get(
    "/api/refueling/contract-used-amount/:priceId",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "view"),
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const usedAmount = await storage.aircraftRefueling.getUsedAmountByPrice(priceId);
        res.json({ usedAmount });
      } catch (error) {
        console.error("Error getting used amount:", error);
        res.status(500).json({ message: "Ошибка получения использованной суммы" });
      }
    }
  );

  app.get(
    "/api/refueling/:id",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "view"),
    async (req, res) => {
      const id = req.params.id;
      const item = await storage.aircraftRefueling.getRefueling(id);
      if (!item) {
        return res.status(404).json({ message: "Заправка не найдена" });
      }
      res.json(item);
    }
  );

  app.get(
    "/api/refueling/order/:id",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "view"),
    async (req, res) => {
      try {
        const deals = await storage.aircraftRefueling.getRefuelingOrder(req.params.id);
        if (!deals.length) {
          return res.status(404).json({ message: "Заказ заправки не найден" });
        }
        res.json(deals);
      } catch (error) {
        console.error("Error fetching refueling order:", error);
        res.status(500).json({ message: "Ошибка загрузки заказа заправки" });
      }
    },
  );

  app.post(
    "/api/refueling/check-duplicate",
    requireAuth,
    async (req, res) => {
      try {
        const isDuplicate = await storage.aircraftRefueling.checkDuplicate(req.body);
        res.json({ isDuplicate });
      } catch (error) {
        console.error("Error checking duplicate refueling:", error);
        res.status(500).json({ message: "Ошибка проверки дубликата" });
      }
    }
  );

  app.post(
    "/api/refueling",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "create"),
    async (req, res) => {
      try {
        // For LIK refueling, check warehouse access
        if (req.body.equipmentType === "lik" && req.body.warehouseId) {
          const allowedWarehouseIds = await storage.warehouses.getUserAllowedLikWarehouseIds(
            String(req.session.userId),
          );
          if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(req.body.warehouseId)) {
            return res.status(403).json({ message: "Нет доступа к указанному складу" });
          }
        }

        const data = insertAircraftRefuelingSchema.parse({
          ...req.body,
            createdById: String(req.session.userId),
        });
        const item = await storage.aircraftRefueling.createRefueling(data);
        await AuditService.log({
          entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
          entityId: item.id,
          operation: AUDIT_OPERATIONS.CREATE,
          newData: item,
          context: (req as any).auditContext || getAuditContext(req),
          extraMeta: { orderProducts: getOrderProductSummary([item]) },
        });
        SSEService.notifyEntityChanged("refueling", SSEService.extractClientId(req.headers["x-client-id"]));
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating refueling:", error?.message || error);
        res.status(500).json({ message: "Ошибка создания заправки" });
      }
    }
  );

  app.post(
    "/api/refueling/bulk",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "create"),
    async (req, res) => {
      try {
        const requestSchema = z.object({
          deals: z.array(insertAircraftRefuelingSchema).min(1).max(3),
        }).superRefine(({ deals }, context) => {
          const types = deals.map((deal) => deal.productType || "");
          if (
            types.some((type) => !["kerosene", "pvkj", "service"].includes(type)) ||
            new Set(types).size !== types.length
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Заказ должен содержать разные продукты: керосин, ПВКЖ и/или услугу",
            });
          }
        });
        const { deals } = requestSchema.parse(req.body);
        const userId = String(req.session.userId);

        for (const deal of deals) {
          if (deal.equipmentType === "lik" && deal.warehouseId) {
            const allowedWarehouseIds =
              await storage.warehouses.getUserAllowedLikWarehouseIds(userId);
            if (
              allowedWarehouseIds !== null &&
              !allowedWarehouseIds.includes(deal.warehouseId)
            ) {
              return res
                .status(403)
                .json({ message: "Нет доступа к указанному складу" });
            }
          }
        }

        const validatedDeals = deals.map((deal) =>
          insertAircraftRefuelingSchema.parse({
            ...deal,
            createdById: userId,
          }),
        );
        const created = await storage.aircraftRefueling.createRefuelings(
          validatedDeals,
        );

        const context = (req as any).auditContext || getAuditContext(req);
        const productSummary = getOrderProductSummary(created);
        await Promise.all(
          created.map((item) =>
            AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
              entityId: item.id,
              operation: AUDIT_OPERATIONS.CREATE,
              newData: item,
              context,
              extraMeta: { orderProducts: productSummary },
            }).catch((auditError) => {
              console.error("Error logging refueling order item audit:", auditError);
            }),
          ),
        );
        SSEService.notifyEntityChanged(
          "refueling",
          SSEService.extractClientId(req.headers["x-client-id"]),
        );
        res.status(201).json(created);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating refueling order:", error?.message || error);
        res.status(500).json({ message: "Ошибка создания заказа заправки" });
      }
    },
  );

  app.patch(
    "/api/refueling/:id",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "edit"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        const item = await storage.aircraftRefueling.getRefueling(req.params.id);
        return item;
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;

        // For LIK refueling, check warehouse access
        if (req.body.equipmentType === "lik" && req.body.warehouseId) {
          const allowedWarehouseIds = await storage.warehouses.getUserAllowedLikWarehouseIds(
            String(req.session.userId),
          );
          if (allowedWarehouseIds !== null && !allowedWarehouseIds.includes(req.body.warehouseId)) {
            return res.status(403).json({ message: "Нет доступа к указанному складу" });
          }
        }

        const item = await storage.aircraftRefueling.updateRefueling(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Заправка не найдена" });
        }
        SSEService.notifyEntityChanged("refueling", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json(item);
      } catch (error) {
        console.error("Error updating refueling:", error);
        res.status(500).json({ message: "Ошибка обновления заправки" });
      }
    }
  );

  app.put(
    "/api/refueling/order/:id",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "edit"),
    async (req, res) => {
      try {
        const requestSchema = z.object({
          deals: z.array(insertAircraftRefuelingSchema).min(1).max(3),
        }).superRefine(({ deals }, context) => {
          const types = deals.map((deal) => deal.productType || "");
          if (
            types.some((type) => !["kerosene", "pvkj", "service"].includes(type)) ||
            new Set(types).size !== types.length
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Заказ должен содержать разные продукты: керосин, ПВКЖ и/или услугу",
            });
          }
        });
        const { deals } = requestSchema.parse(req.body);
        const userId = String(req.session.userId);
        for (const deal of deals) {
          if (deal.equipmentType === "lik" && deal.warehouseId) {
            const allowedWarehouseIds =
              await storage.warehouses.getUserAllowedLikWarehouseIds(userId);
            if (
              allowedWarehouseIds !== null &&
              !allowedWarehouseIds.includes(deal.warehouseId)
            ) {
              return res.status(403).json({ message: "Нет доступа к указанному складу" });
            }
          }
        }
        const validatedDeals = deals.map((deal) =>
          insertAircraftRefuelingSchema.parse({ ...deal, updatedById: userId }),
        );
        const { oldDeals, deals: savedDeals } =
          await storage.aircraftRefueling.updateRefuelingOrder(
            req.params.id,
            validatedDeals,
            userId,
          );
        const context = (req as any).auditContext || getAuditContext(req);
        const oldByType = new Map(oldDeals.map((deal) => [deal.productType, deal]));
        const newByType = new Map(savedDeals.map((deal) => [deal.productType, deal]));
        const productSummary = getOrderProductSummary(savedDeals);
        const previousProductSummary = getOrderProductSummary(oldDeals);

        await Promise.all([
          ...savedDeals.map((deal) => {
            const old = oldByType.get(deal.productType);
            return AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
              entityId: deal.id,
              operation: old ? AUDIT_OPERATIONS.UPDATE : AUDIT_OPERATIONS.CREATE,
              oldData: old || undefined,
              newData: deal,
              context,
              extraMeta: { orderProducts: productSummary },
            });
          }),
          ...oldDeals
            .filter((deal) => !newByType.has(deal.productType))
            .map((deal) =>
              AuditService.log({
                entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
                entityId: deal.id,
                operation: AUDIT_OPERATIONS.DELETE,
                oldData: deal,
                context,
                extraMeta: { orderProducts: previousProductSummary },
              }),
            ),
        ]);
        SSEService.notifyEntityChanged("refueling", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json(savedDeals);
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }

        const expectedErrors = new Map<string, { status: number; message: string }>([
          ["Заказ должен содержать от одного до трёх продуктов", {
            status: 400,
            message: "Заказ должен содержать от одного до трёх продуктов",
          }],
          ["В заказе не должно быть повторяющихся или неизвестных продуктов", {
            status: 400,
            message: "В заказе не должно быть повторяющихся или неизвестных продуктов",
          }],
          ["Заказ заправки не найден", {
            status: 404,
            message: "Заказ заправки не найден",
          }],
          ["Заказ изменён другим пользователем. Обновите список и попробуйте снова", {
            status: 409,
            message: "Заказ изменён другим пользователем. Обновите список и попробуйте снова",
          }],
          ["Оборудование не найдено", {
            status: 409,
            message: "Оборудование заправки не найдено. Обновите данные и попробуйте снова.",
          }],
        ]);
        const errorMessage = error instanceof Error ? error.message : "";
        const expectedFailure =
          expectedErrors.get(errorMessage) ||
          (/^Warehouse .+ not found$/.test(errorMessage)
            ? {
                status: 409,
                message: "Склад заправки не найден. Обновите данные и попробуйте снова.",
              }
            : undefined);
        if (expectedFailure) {
          return res.status(expectedFailure.status).json({ message: expectedFailure.message });
        }

        console.error("Error updating refueling order:", error);
        return res.status(500).json({
          message: "Не удалось сохранить заказ заправки. Попробуйте снова.",
        });
      }
    },
  );

  app.delete(
    "/api/refueling/order/:id",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "delete"),
    async (req, res) => {
      try {
        const oldDeals = await storage.aircraftRefueling.deleteRefuelingOrder(
          req.params.id,
          String(req.session.userId),
        );
        if (!oldDeals.length) {
          return res.status(404).json({ message: "Заказ заправки не найден" });
        }
        const context = (req as any).auditContext || getAuditContext(req);
        const productSummary = getOrderProductSummary(oldDeals);
        await Promise.all(
          oldDeals.map((deal) =>
            AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
              entityId: deal.id,
              operation: AUDIT_OPERATIONS.DELETE,
              oldData: deal,
              context,
              extraMeta: { orderProducts: productSummary },
            }),
          ),
        );
        SSEService.notifyEntityChanged("refueling", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json({ message: "Заказ заправки удалён", deletedDeals: oldDeals.length });
      } catch (error: any) {
        console.error("Error deleting refueling order:", error?.message || error);
        res.status(500).json({ message: error?.message || "Ошибка удаления заказа заправки" });
      }
    },
  );

  app.delete(
    "/api/refueling/:id",
    requireAuth,
    requireAnyPermission(["refueling", "lik-refueling"], "delete"),
    async (req, res) => {
      try {
        const oldDeals = await storage.aircraftRefueling.deleteRefuelingOrder(
          req.params.id,
          String(req.session.userId),
        );
        if (!oldDeals.length) {
          return res.status(404).json({ message: "Заказ заправки не найден" });
        }
        const context = (req as any).auditContext || getAuditContext(req);
        const productSummary = getOrderProductSummary(oldDeals);
        await Promise.all(
          oldDeals.map((deal) =>
            AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING,
              entityId: deal.id,
              operation: AUDIT_OPERATIONS.DELETE,
              oldData: deal,
              context,
              extraMeta: { orderProducts: productSummary },
            }),
          ),
        );
        SSEService.notifyEntityChanged("refueling", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json({ message: "Заказ заправки удалён", deletedDeals: oldDeals.length });
      } catch (error: any) {
        console.error("Error deleting refueling:", error?.message || error);
        res.status(500).json({ message: error?.message || "Ошибка удаления заказа заправки" });
      }
    }
  );
}
