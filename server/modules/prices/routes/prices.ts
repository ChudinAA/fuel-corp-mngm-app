import type { Express } from "express";
import { isPriceContractRequired } from "@shared/price-contract-selection";
import { storage } from "../../../storage/index";
import { insertPriceSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";
import { SSEService } from "../../../services/sse-service";
import {
  priceSelectionVolumeToApi,
  priceResponseToApi,
  priceUnitFilterToStorage,
  normalizePriceValuesForStorage,
  priceWriteFromApi,
} from "../price-unit-adapters";

export function registerPricesRoutes(app: Express) {
  app.get(
    "/api/prices/calculate-selection",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      try {
        const {
          counterpartyId,
          counterpartyType,
          basis,
          dateFrom,
          dateTo,
          priceId,
        } = req.query;

        if (
          !counterpartyId ||
          !counterpartyType ||
          !basis ||
          !dateFrom ||
          !dateTo
        ) {
          return res
            .status(400)
            .json({ message: "Не указаны обязательные параметры" });
        }

        const { totalVolume, totalAmount } = await storage.prices.calculatePriceSelection(
          counterpartyId as string,
          counterpartyType as string,
          basis as string,
          dateFrom as string,
          dateTo as string,
          priceId as string | undefined,
        );

        res.json({
          totalVolume: totalVolume.toFixed(5),
          totalVolumeUnit: "tonne",
          volume: priceSelectionVolumeToApi(totalVolume),
          totalAmount: totalAmount.toFixed(2),
        });
      } catch (error) {
        console.error("Selection calculation error:", error);
        res.status(500).json({ message: "Ошибка расчета выборки" });
      }
    },
  );

  app.get(
    "/api/prices/last-contract-info",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      try {
        const { counterpartyId, counterpartyType, counterpartyRole, contractNumber } = req.query;
        if (!counterpartyId || !counterpartyType || !counterpartyRole) {
          return res.status(400).json({ message: "Не указаны обязательные параметры" });
        }
        const result = await storage.prices.getLastContractInfo(
          String(counterpartyId),
          String(counterpartyType),
          String(counterpartyRole),
          contractNumber ? String(contractNumber) : undefined,
        );
        res.json(result);
      } catch (error) {
        console.error("Last contract info error:", error);
        res.status(500).json({ message: "Ошибка получения информации о договоре" });
      }
    },
  );

  app.get(
    "/api/prices/check-date-overlaps",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      const {
        counterpartyId,
        counterpartyType,
        counterpartyRole,
        basis,
        productType,
        dateFrom,
        dateTo,
        excludeId,
        basisId,
        loadingBasisId,
        nomenclatureId,
      } = req.query;
      const result = await storage.prices.checkPriceDateOverlaps(
        String(counterpartyId),
        String(counterpartyType),
        String(counterpartyRole),
        String(basis),
        String(productType),
        String(dateFrom),
        String(dateTo),
        excludeId ? String(excludeId) : undefined,
        basisId ? String(basisId) : undefined,
        loadingBasisId ? String(loadingBasisId) : undefined,
        nomenclatureId ? String(nomenclatureId) : undefined,
      );
      res.json(result);
    },
  );

  app.get(
    "/api/prices/find-active",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      try {
        const {
          counterpartyId,
          counterpartyRole,
          counterpartyType,
          basisId,
          loadingBasisId,
          productType,
          nomenclatureId,
          date,
          priceUnit,
        } = req.query;

        if (
          !counterpartyId ||
          !counterpartyRole ||
          !counterpartyType ||
          !date
        ) {
          return res
            .status(400)
            .json({ message: "Missing required parameters" });
        }

        let storedPriceUnits: string[] | undefined;
        try {
          storedPriceUnits = priceUnitFilterToStorage(priceUnit);
        } catch {
          return res.status(400).json({ message: "Неизвестная единица цены" });
        }

        const data = await storage.prices.findActivePrices({
          counterpartyId: counterpartyId as string,
          counterpartyRole: counterpartyRole as string,
          counterpartyType: counterpartyType as string,
          basisId: basisId as string,
          loadingBasisId: loadingBasisId as string,
          productType: productType as string,
          nomenclatureId: nomenclatureId as string | undefined,
          date: date as string,
          priceUnit: storedPriceUnits,
        });

        res.json(priceResponseToApi(data));
      } catch (error) {
        console.error("Price lookup error:", error);
        res.status(500).json({ message: "Error looking up prices" });
      }
    },
  );

  app.get(
    "/api/prices/list",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      const {
        counterpartyRole,
        counterpartyType,
        counterpartyId,
        dateFrom,
        dateTo,
        basis,
        productType,
        offset,
        pageSize,
      } = req.query;

      // Вспомогательная функция: парсит строку "val1,val2" → массив или одно значение
      const parseMulti = (raw: string | string[] | undefined): string | string[] | undefined => {
        if (!raw) return undefined;
        const str = Array.isArray(raw) ? raw.join(",") : raw;
        if (!str) return undefined;
        const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length === 0) return undefined;
        return parts.length === 1 ? parts[0] : parts;
      };

      // Поддержка filter_* (от buildFilterQueryString) и прямых параметров
      const resolveFilter = (key: string) =>
        parseMulti(req.query[`filter_${key}`] as string | undefined) ??
        parseMulti(req.query[key] as string | undefined);

      const data = await storage.prices.getAllPrices(
        offset ? parseInt(offset as string) : 0,
        pageSize ? parseInt(pageSize as string) : 100,
        {
          counterpartyRole:  resolveFilter("counterpartyRole"),
          counterpartyType:  resolveFilter("counterpartyType"),
          counterpartyId:    resolveFilter("counterpartyId"),
          dateFrom: dateFrom as string | undefined,
          dateTo:   dateTo as string | undefined,
          basis:    resolveFilter("basis"),
          productType: resolveFilter("productType"),
        },
      );
        res.json(priceResponseToApi(data));
    },
  );

  app.get(
    "/api/prices/:id",
    requireAuth,
    requirePermission("prices", "view"),
    async (req, res) => {
      const id = req.params.id;
      const price = await storage.prices.getPrice(id);
      if (!price) {
        return res.status(404).json({ message: "Цена не найдена" });
      }
      res.json(priceResponseToApi(price));
    },
  );

  app.post(
    "/api/prices",
    requireAuth,
    requirePermission("prices", "create"),
    auditLog({
      entityType: ENTITY_TYPES.PRICE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const body = priceWriteFromApi(req.body);

        const requiresNomenclature = ["kerosene", "pvkj", "service"].includes(String(body.productType));
        if (isPriceContractRequired(String(body.counterpartyType)) && !body.contractId) {
          return res.status(400).json({ message: "Выберите договор из справочника" });
        }
        if (requiresNomenclature && !body.nomenclatureId) {
          return res.status(400).json({ message: "Выберите номенклатуру" });
        }
        if (requiresNomenclature) {
          const available = await storage.catalogs.getNomenclature(String(body.productType));
          if (!available.some((item) => item.id === body.nomenclatureId)) {
            return res.status(400).json({ message: "Номенклатура не соответствует выбранному типу продукта" });
          }
        }
        const selectedContract = body.contractId
          ? await storage.catalogs.getContract(String(body.contractId))
          : undefined;
        if (body.contractId && !selectedContract) {
          return res.status(400).json({ message: "Выбранный договор не найден или удалён" });
        }
        const contractMatchesCounterparty =
          body.counterpartyRole === "supplier"
            ? selectedContract?.supplierId === body.counterpartyId
            : selectedContract?.buyerId === body.counterpartyId;
        if (selectedContract && !contractMatchesCounterparty) {
          return res.status(400).json({ message: "Договор не относится к выбранному контрагенту" });
        }

        console.log("[PRICE CREATE DEBUG] body.limitType:", body.limitType, "body.volume:", body.volume, "body.maxDealAmount:", body.maxDealAmount);
        const limitType = body.limitType || "volume";
        const contractLimitEnabled = body.contractLimitEnabled !== false;
        if (contractLimitEnabled && limitType !== "amount" && !body.volume) {
          return res.status(400).json({ message: "Укажите объем по договору" });
        }
        if (contractLimitEnabled && limitType === "amount" && !body.maxDealAmount) {
          return res.status(400).json({ message: "Укажите максимальную сумму сделки" });
        }

        // Валидация пересечения дат перед созданием
        const overlapResult = await storage.prices.checkPriceDateOverlaps(
          String(body.counterpartyId),
          String(body.counterpartyType),
          String(body.counterpartyRole),
          String(body.basis),
          String(body.productType),
          String(body.dateFrom),
          String(body.dateTo),
          undefined,
          body.basisId ? String(body.basisId) : undefined,
          body.loadingBasisId ? String(body.loadingBasisId) : undefined,
          body.nomenclatureId ? String(body.nomenclatureId) : undefined,
        );

        if (overlapResult.status === "error") {
          return res.status(400).json({ message: overlapResult.message });
        }

        const processedData = {
          ...body,
          contractId: selectedContract?.id || null,
          contractNumber: selectedContract?.contractNumber || null,
          contractAppendix: selectedContract?.parentContractId ? selectedContract.contractNumber : null,
          priceValues: normalizePriceValuesForStorage(body.priceValues),
          volume: limitType !== "amount" && body.volume ? String(body.volume) : null,
          maxDealAmount: limitType === "amount" && body.maxDealAmount ? String(body.maxDealAmount) : null,
          counterpartyId: body.counterpartyId,
          notes: body.notes || null,
          createdById: req.session.userId,
        };

        const data = insertPriceSchema.parse(processedData);
        const item = await storage.prices.createPrice(data);
        SSEService.notifyEntityChanged("prices", SSEService.extractClientId(req.headers["x-client-id"]));
        res.status(201).json(priceResponseToApi(item));
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Price creation error:", error);
        res.status(500).json({ message: "Ошибка создания цены" });
      }
    },
  );

  app.patch(
    "/api/prices/:id",
    requireAuth,
    requirePermission("prices", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.PRICE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.prices.getPrice(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const body = priceWriteFromApi(req.body);

        // Валидация пересечения дат перед обновлением
        if (body.dateFrom && body.dateTo) {
          const currentPrice = await storage.prices.getPrice(id);
          if (currentPrice) {
            const overlapResult = await storage.prices.checkPriceDateOverlaps(
              String(body.counterpartyId || currentPrice.counterpartyId),
              String(body.counterpartyType || currentPrice.counterpartyType),
              String(body.counterpartyRole || currentPrice.counterpartyRole),
              String(body.basis || currentPrice.basis),
              String(body.productType || currentPrice.productType),
              String(body.dateFrom),
              String(body.dateTo),
              String(id),
              body.basisId || currentPrice.basisId || undefined,
              body.loadingBasisId ? String(body.loadingBasisId) : (currentPrice.loadingBasisId ? String(currentPrice.loadingBasisId) : undefined),
              body.nomenclatureId || currentPrice.nomenclatureId || undefined,
            );

            if (overlapResult.status === "error") {
              return res.status(400).json({
                message:
                  overlapResult.status === "error"
                    ? overlapResult.message
                    : undefined,
              });
            }
          }
        }

        let selectedContractForUpdate: Awaited<ReturnType<typeof storage.catalogs.getContract>> | undefined;
        if (body.contractId) {
          selectedContractForUpdate = await storage.catalogs.getContract(String(body.contractId)) || undefined;
          const current = await storage.prices.getPrice(id);
          const role = body.counterpartyRole || current?.counterpartyRole;
          const partyId = body.counterpartyId || current?.counterpartyId;
          const matches = role === "supplier"
            ? selectedContractForUpdate?.supplierId === partyId
            : selectedContractForUpdate?.buyerId === partyId;
          if (!selectedContractForUpdate || !matches) {
            return res.status(400).json({ message: "Договор не относится к выбранному контрагенту" });
          }
        }

        const effectiveProductType = String(body.productType || (await storage.prices.getPrice(id))?.productType || "");
        if (body.nomenclatureId && ["kerosene", "pvkj", "service"].includes(effectiveProductType)) {
          const availableNomenclature = await storage.catalogs.getNomenclature(effectiveProductType);
          if (!availableNomenclature.some((item) => item.id === body.nomenclatureId)) {
            return res.status(400).json({ message: "Номенклатура не соответствует выбранному типу продукта" });
          }
        }

        // Process priceValues if they exist
        const patchLimitType = body.limitType || "volume";
        const processedData = {
          ...body,
          ...(selectedContractForUpdate
            ? {
                contractNumber: selectedContractForUpdate.contractNumber,
                contractAppendix: selectedContractForUpdate.parentContractId ? selectedContractForUpdate.contractNumber : null,
              }
            : body.contractId === null || body.contractId === ""
              ? { contractId: null, contractNumber: null, contractAppendix: null }
              : {}),
          priceValues: normalizePriceValuesForStorage(body.priceValues),
          volume: patchLimitType !== "amount" && body.volume ? String(body.volume) : null,
          maxDealAmount: patchLimitType === "amount" && body.maxDealAmount ? String(body.maxDealAmount) : null,
          notes: body.notes || null,
          updatedById: req.session.userId,
        };

        const item = await storage.prices.updatePrice(id, processedData);
        if (!item) {
          return res.status(404).json({ message: "Цена не найдена" });
        }
        SSEService.notifyEntityChanged("prices", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json(priceResponseToApi(item));
      } catch (error) {
        console.error("Price update error:", error);
        res.status(500).json({ message: "Ошибка обновления цены" });
      }
    },
  );

  app.delete(
    "/api/prices/:id",
    requireAuth,
    requirePermission("prices", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.PRICE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.prices.getPrice(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.prices.deletePrice(id, String(req.session.userId));
        SSEService.notifyEntityChanged("prices", SSEService.extractClientId(req.headers["x-client-id"]));
        res.json({ message: "Цена удалена" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления цены" });
      }
    },
  );
}
