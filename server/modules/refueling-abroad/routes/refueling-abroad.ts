import type { Express } from "express";
import { refuelingAbroadStorage } from "../storage/refueling-abroad-storage";
import { refuelingAbroadIntermediariesStorage } from "../storage/refueling-abroad-intermediaries-storage";
import { refuelingAbroadExchangeRatesStorage } from "../storage/refueling-abroad-exchange-rates-storage";
import { refuelingAbroadBankCommissionsStorage } from "../storage/refueling-abroad-bank-commissions-storage";
import { insertRefuelingAbroadSchema } from "../entities/refueling-abroad";
import { insertRefuelingAbroadIntermediarySchema } from "../entities/refueling-abroad-intermediaries";
import { insertRefuelingAbroadExchangeRateSchema } from "../entities/refueling-abroad-exchange-rates";
import { insertRefuelingAbroadBankCommissionSchema } from "../entities/refueling-abroad-bank-commissions";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, getAuditContext } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { AuditService } from "../../audit/services/audit-service";

/** Строит полную метку сделки для записей аудита — в формате entity summary */
async function buildDealLabel(refuelingId: string): Promise<string> {
  try {
    // getById включает supplier и buyer через relations
    const deal = await refuelingAbroadStorage.getById(refuelingId) as any;
    if (!deal) return "";
    const parts: string[] = [];

    // Дата: DD.MM.YY
    if (deal.refuelingDate) {
      const d = String(deal.refuelingDate).slice(0, 10);
      const [y, m, day] = d.split("-");
      parts.push(`${day}.${m}.${y.slice(-2)}`);
    }

    // Номер ВС
    if (deal.aircraftNumber) parts.push(String(deal.aircraftNumber));

    // Тип топлива
    if (deal.productType) {
      const prodLabels: Record<string, string> = {
        jet_fuel: "Авиакеросин", kerosene: "Керосин", diesel: "Дизельное топливо",
        pvkj: "ПВКЖ", pvkj_tk: "ПВКЖ ТК", gasoline: "Бензин",
        avgas: "AVGAS", mogas: "MOGAS",
      };
      parts.push(prodLabels[deal.productType] || deal.productType);
    }

    // Количество
    const qtyKg = deal.quantityKg != null ? Number(deal.quantityKg) : 0;
    const qtyL = deal.quantityLiters != null ? Number(deal.quantityLiters) : 0;
    if (qtyKg > 0) {
      parts.push(`${qtyKg.toLocaleString("ru-RU")} кг`);
    } else if (qtyL > 0) {
      parts.push(`${qtyL.toLocaleString("ru-RU")} л`);
    }

    // Поставщик
    const supplierName = deal.supplier?.name;
    if (supplierName) parts.push(supplierName);

    // Покупатель
    const buyerName = deal.buyer?.name;
    if (buyerName) parts.push(`→ ${buyerName}`);

    return parts.join(" · ");
  } catch {
    return "";
  }
}

export function registerRefuelingAbroadRoutes(app: Express) {
  app.get(
    "/api/refueling-abroad",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const offset = parseInt(req.query.offset as string) || 0;
        const limit = parseInt(req.query.pageSize as string) || 100;
        const search = req.query.search as string;

        // Parse column filters
        const columnFilters: Record<string, string[]> = {};
        Object.keys(req.query).forEach((key) => {
          if (key.startsWith("filter_")) {
            const columnId = key.replace("filter_", "");
            columnFilters[columnId] = (req.query[key] as string).split(",");
          }
        });

        // Передаём dateFrom/dateTo в фильтры
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        if (dateFrom) columnFilters["dateFrom"] = [dateFrom];
        if (dateTo) columnFilters["dateTo"] = [dateTo];

        const result = await refuelingAbroadStorage.getAll(
          offset,
          limit,
          search,
          columnFilters,
        );
        res.json(result);
      } catch (error: any) {
        console.error("Error fetching refueling abroad records:", error);
        res
          .status(500)
          .json({ message: "Ошибка получения записей заправки зарубеж" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/filter-values",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const column = req.query.column as string;
        const q = (req.query.q as string) || "";
        const result = await refuelingAbroadStorage.getFilterValues(column, q);
        res.json(result);
      } catch (err) {
        res.status(500).json([]);
      }
    },
  );

  app.get(
    "/api/refueling-abroad/contract-used/:priceId",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const { priceId } = req.params;
        const usedVolume =
          await refuelingAbroadStorage.getUsedVolumeByPrice(priceId);
        res.json({ usedVolume });
      } catch (error) {
        console.error("Error getting used volume:", error);
        res
          .status(500)
          .json({ message: "Ошибка получения использованного объема" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/drafts",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const drafts = await refuelingAbroadStorage.getDrafts();
        res.json(drafts);
      } catch (error: any) {
        console.error("Error fetching drafts:", error);
        res.status(500).json({ message: "Ошибка получения черновиков" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/:id",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const item = await refuelingAbroadStorage.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        console.error("Error fetching refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка получения записи" });
      }
    },
  );

  app.post(
    "/api/refueling-abroad",
    requireAuth,
    requirePermission("abroad", "create"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadSchema.parse(req.body);
        const userId = req.session.userId?.toString();
        const item = await refuelingAbroadStorage.create(validatedData, userId);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error creating refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка создания записи" });
      }
    },
  );

  app.patch(
    "/api/refueling-abroad/:id",
    requireAuth,
    requirePermission("abroad", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await refuelingAbroadStorage.getById(req.params.id);
      },
      getNewData: (req) => {
        // Исключаем поля дочерних сущностей — они аудируются отдельными PUT-маршрутами.
        // Если их не исключить, ложные diff-ы возникают из-за разного представления
        // в теле запроса (строка или массив) vs нормализованных данных из БД.
        const { intermediaries, bankCommissions, chainExchangeRates, ...rest } = req.body;
        return rest;
      },
    }),
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadSchema.parse(req.body);
        const userId = req.session.userId?.toString();
        const item = await refuelingAbroadStorage.update(
          req.params.id,
          validatedData,
          userId,
        );
        if (!item) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error updating refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка обновления записи" });
      }
    },
  );

  app.delete(
    "/api/refueling-abroad/:id",
    requireAuth,
    requirePermission("abroad", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await refuelingAbroadStorage.getById(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const userId = req.session.userId?.toString();
        const success = await refuelingAbroadStorage.softDelete(
          req.params.id,
          userId,
        );
        if (!success) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка удаления записи" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/by-supplier/:supplierId",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getBySupplierId(
          req.params.supplierId,
        );
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching by supplier:", error);
        res.status(500).json({ message: "Ошибка получения записей" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/by-buyer/:buyerId",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getByBuyerId(
          req.params.buyerId,
        );
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching by buyer:", error);
        res.status(500).json({ message: "Ошибка получения записей" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/by-storage-card/:storageCardId",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getByStorageCardId(
          req.params.storageCardId,
        );
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching by storage card:", error);
        res.status(500).json({ message: "Ошибка получения записей" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad/:id/intermediaries",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items =
          await refuelingAbroadIntermediariesStorage.getByRefuelingIdWithDetails(
            req.params.id,
          );
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching intermediaries:", error);
        res.status(500).json({ message: "Ошибка получения посредников" });
      }
    },
  );

  app.put(
    "/api/refueling-abroad/:id/intermediaries",
    requireAuth,
    requirePermission("abroad", "edit"),
    async (req, res) => {
      try {
        const intermediariesSchema = z.array(
          insertRefuelingAbroadIntermediarySchema.omit({
            refuelingAbroadId: true,
          }),
        );
        const validatedData = intermediariesSchema.parse(req.body);

        // Снапшот старых посредников для аудита (с именами через детальный запрос)
        const formatIntermediary = (item: any): string => {
          const name = item.name || item.intermediaryId || "—";
          const parts = [`${name}`];
          if (item.commissionFormula) parts.push(`формула: ${item.commissionFormula}`);
          if (item.commissionUsd != null) parts.push(`${item.commissionUsd} USD`);
          if (item.commissionRub != null) parts.push(`${item.commissionRub} руб.`);
          return parts.join(", ");
        };

        let oldIntermediariesStr = "—";
        try {
          const oldItems = await refuelingAbroadIntermediariesStorage.getByRefuelingIdWithDetails(req.params.id);
          oldIntermediariesStr = oldItems.map(formatIntermediary).join("; ") || "—";
        } catch {}

        const items =
          await refuelingAbroadIntermediariesStorage.replaceForRefueling(
            req.params.id,
            validatedData,
          );

        // Снапшот новых посредников для аудита
        let newIntermediariesStr = "—";
        try {
          const newItems = await refuelingAbroadIntermediariesStorage.getByRefuelingIdWithDetails(req.params.id);
          newIntermediariesStr = newItems.map(formatIntermediary).join("; ") || "—";
        } catch {}

        // Аудит: только если данные реально изменились
        if (oldIntermediariesStr !== newIntermediariesStr) {
          try {
            const context = (req as any).auditContext || getAuditContext(req);
            // Метка сделки для панели аудита
            const dealLabel = await buildDealLabel(req.params.id);
            await AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
              entityId: req.params.id,
              operation: AUDIT_OPERATIONS.UPDATE,
              oldData: { intermediaries: oldIntermediariesStr },
              newData: { intermediaries: newIntermediariesStr },
              context,
              extraMeta: dealLabel ? { __dealLabel: dealLabel } : undefined,
            });
          } catch {}

          // Если посредники устанавливаются впервые — обогащаем CREATE-запись
          if (
            (oldIntermediariesStr === "—") &&
            newIntermediariesStr !== "—"
          ) {
            try {
              await AuditService.enrichCreateRecord(
                ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
                req.params.id,
                { intermediaries: newIntermediariesStr },
              );
            } catch {}
          }
        }

        res.json(items);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error updating intermediaries:", error);
        res.status(500).json({ message: "Ошибка обновления посредников" });
      }
    },
  );

  app.post(
    "/api/refueling-abroad/:id/intermediaries",
    requireAuth,
    requirePermission("abroad", "edit"),
    async (req, res) => {
      try {
        const validatedData = insertRefuelingAbroadIntermediarySchema
          .omit({ refuelingAbroadId: true })
          .parse(req.body);
        const item = await refuelingAbroadIntermediariesStorage.create({
          ...validatedData,
          refuelingAbroadId: req.params.id,
        });
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error creating intermediary:", error);
        res.status(500).json({ message: "Ошибка добавления посредника" });
      }
    },
  );

  app.delete(
    "/api/refueling-abroad/:refuelingId/intermediaries/:id",
    requireAuth,
    requirePermission("abroad", "edit"),
    async (req, res) => {
      try {
        const success = await refuelingAbroadIntermediariesStorage.delete(
          req.params.id,
        );
        if (!success) {
          return res.status(404).json({ message: "Посредник не найден" });
        }
        res.json({ success: true });
      } catch (error: any) {
        console.error("Error deleting intermediary:", error);
        res.status(500).json({ message: "Ошибка удаления посредника" });
      }
    },
  );

  // =========== EXCHANGE RATES IN DEAL CHAIN ===========
  app.get(
    "/api/refueling-abroad/:id/chain-exchange-rates",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadExchangeRatesStorage.getByRefuelingId(req.params.id);
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching chain exchange rates:", error);
        res.status(500).json({ message: "Ошибка получения курсов в цепочке" });
      }
    },
  );

  app.put(
    "/api/refueling-abroad/:id/chain-exchange-rates",
    requireAuth,
    requirePermission("abroad", "edit"),
    async (req, res) => {
      try {
        const items = z.array(insertRefuelingAbroadExchangeRateSchema.omit({ refuelingAbroadId: true })).parse(req.body);

        const formatRate = (item: any): string => {
          const parts: string[] = [];
          if (item.fromCurrencyCode && item.toCurrencyCode) {
            parts.push(`${item.fromCurrencyCode}→${item.toCurrencyCode}`);
          }
          if (item.rate != null) parts.push(`курс: ${item.rate}`);
          if (item.rateDate) parts.push(String(item.rateDate).slice(0, 10));
          if (item.notes) parts.push(item.notes);
          return parts.join(", ") || "—";
        };

        // Снапшот старых курсов для аудита
        let oldRatesStr = "—";
        try {
          const oldItems = await refuelingAbroadExchangeRatesStorage.getByRefuelingId(req.params.id);
          oldRatesStr = oldItems.map(formatRate).join("; ") || "—";
        } catch {}

        const result = await refuelingAbroadExchangeRatesStorage.replaceForRefueling(req.params.id, items);

        // Снапшот новых курсов для аудита
        let newRatesStr = "—";
        try {
          const newItems = await refuelingAbroadExchangeRatesStorage.getByRefuelingId(req.params.id);
          newRatesStr = newItems.map(formatRate).join("; ") || "—";
        } catch {}

        // Аудит: только если данные реально изменились
        if (oldRatesStr !== newRatesStr) {
          try {
            const context = (req as any).auditContext || getAuditContext(req);
            const dealLabel = await buildDealLabel(req.params.id);
            await AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
              entityId: req.params.id,
              operation: AUDIT_OPERATIONS.UPDATE,
              oldData: { chainExchangeRates: oldRatesStr },
              newData: { chainExchangeRates: newRatesStr },
              context,
              extraMeta: dealLabel ? { __dealLabel: dealLabel } : undefined,
            });
          } catch {}

          // Если курсы устанавливаются впервые — обогащаем CREATE-запись
          if (oldRatesStr === "—" && newRatesStr !== "—") {
            try {
              await AuditService.enrichCreateRecord(
                ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
                req.params.id,
                { chainExchangeRates: newRatesStr },
              );
            } catch {}
          }
        }

        res.json(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error replacing chain exchange rates:", error);
        res.status(500).json({ message: "Ошибка обновления курсов в цепочке" });
      }
    },
  );

  // =========== BANK COMMISSIONS IN DEAL CHAIN ===========
  app.get(
    "/api/refueling-abroad/:id/chain-bank-commissions",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadBankCommissionsStorage.getByRefuelingId(req.params.id);
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching chain bank commissions:", error);
        res.status(500).json({ message: "Ошибка получения комиссий банков в цепочке" });
      }
    },
  );

  app.put(
    "/api/refueling-abroad/:id/chain-bank-commissions",
    requireAuth,
    requirePermission("abroad", "edit"),
    async (req, res) => {
      try {
        const parsed = z.array(insertRefuelingAbroadBankCommissionSchema.omit({ refuelingAbroadId: true })).parse(req.body);

        const formatBank = (item: any): string => {
          const name = item.bankName || item.name || item.bankId || "—";
          const parts = [`${name}`];
          if (item.commissionUsd != null) parts.push(`${item.commissionUsd} USD`);
          if (item.commissionRub != null) parts.push(`${item.commissionRub} руб.`);
          return parts.join(", ");
        };

        // Снапшот старых банков для аудита
        let oldBanksStr = "—";
        try {
          const oldItems = await refuelingAbroadBankCommissionsStorage.getByRefuelingId(req.params.id);
          oldBanksStr = (oldItems as any[]).map(formatBank).join("; ") || "—";
        } catch {}

        const result = await refuelingAbroadBankCommissionsStorage.replaceForRefueling(req.params.id, parsed);

        // Снапшот новых банков для аудита
        let newBanksStr = "—";
        try {
          const newItems = await refuelingAbroadBankCommissionsStorage.getByRefuelingId(req.params.id);
          newBanksStr = (newItems as any[]).map(formatBank).join("; ") || "—";
        } catch {}

        // Аудит: только если данные реально изменились
        if (oldBanksStr !== newBanksStr) {
          try {
            const context = (req as any).auditContext || getAuditContext(req);
            const dealLabel = await buildDealLabel(req.params.id);
            await AuditService.log({
              entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
              entityId: req.params.id,
              operation: AUDIT_OPERATIONS.UPDATE,
              oldData: { bankCommissions: oldBanksStr },
              newData: { bankCommissions: newBanksStr },
              context,
              extraMeta: dealLabel ? { __dealLabel: dealLabel } : undefined,
            });
          } catch {}

          // Если банки устанавливаются впервые — обогащаем CREATE-запись
          if (oldBanksStr === "—" && newBanksStr !== "—") {
            try {
              await AuditService.enrichCreateRecord(
                ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
                req.params.id,
                { bankCommissions: newBanksStr },
              );
            } catch {}
          }
        }

        res.json(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Ошибка валидации", errors: error.errors });
        }
        console.error("Error replacing chain bank commissions:", error);
        res.status(500).json({ message: "Ошибка обновления комиссий банков в цепочке" });
      }
    },
  );

  app.get(
    "/api/refueling-abroad-deleted",
    requireAuth,
    requirePermission("abroad", "view"),
    async (req, res) => {
      try {
        const items = await refuelingAbroadStorage.getDeleted();
        res.json(items);
      } catch (error: any) {
        console.error("Error fetching deleted records:", error);
        res.status(500).json({ message: "Ошибка получения удаленных записей" });
      }
    },
  );

  app.post(
    "/api/refueling-abroad/:id/restore",
    requireAuth,
    requirePermission("abroad", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.AIRCRAFT_REFUELING_ABROAD,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await refuelingAbroadStorage.getByIdIncludingDeleted(
          req.params.id,
        );
      },
      getNewData: () => ({ restored: true }),
    }),
    async (req, res) => {
      try {
        const userId = req.session.userId?.toString();
        const item = await refuelingAbroadStorage.restore(
          req.params.id,
          userId,
        );
        if (!item) {
          return res.status(404).json({ message: "Запись не найдена" });
        }
        res.json(item);
      } catch (error: any) {
        console.error("Error restoring refueling abroad record:", error);
        res.status(500).json({ message: "Ошибка восстановления записи" });
      }
    },
  );
}
