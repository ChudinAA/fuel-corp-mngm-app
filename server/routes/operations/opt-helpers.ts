
import type { Express } from "express";
import { storage } from "../../storage/index";
import { requireAuth } from "../middleware";
import { db } from "../../db";
import { sql } from "drizzle-orm";

export function registerOptHelpersRoutes(app: Express) {
  // Получение доступных опций для формы
  app.get("/api/opt/form-options", requireAuth, async (req, res) => {
    try {
      const { supplierId, buyerId, dealDate, basis, carrierId, deliveryLocationId, warehouseId } = req.query;

      const result: any = {
        purchasePrices: [],
        salePrices: [],
        deliveryCost: null,
        warehouseStatus: null,
      };

      // Получаем цены покупки
      if (supplierId && basis && dealDate) {
        const dateStr = dealDate as string;
        const purchasePrices = await db.query.prices.findMany({
          where: sql`
            counterparty_id = ${supplierId} AND
            counterparty_type = 'wholesale' AND
            counterparty_role = 'supplier' AND
            product_type = 'kerosine' AND
            basis = ${basis} AND
            date_from <= ${dateStr} AND
            date_to >= ${dateStr} AND
            is_active = true
          `,
          columns: {
            id: true,
            priceValues: true,
            dateFrom: true,
            dateTo: true,
          },
        });

        result.purchasePrices = purchasePrices.map(p => ({
          id: p.id,
          values: (p.priceValues || []).map((v, idx) => {
            try {
              const parsed = JSON.parse(v);
              return {
                compositeId: `${p.id}-${idx}`,
                price: parsed.price,
                label: `${parsed.price} ₽/кг (${p.dateFrom} - ${p.dateTo})`,
              };
            } catch {
              return null;
            }
          }).filter(Boolean),
        })).filter(p => p.values.length > 0);
      }

      // Получаем цены продажи
      if (buyerId && dealDate) {
        const dateStr = dealDate as string;
        const salePrices = await db.query.prices.findMany({
          where: sql`
            counterparty_id = ${buyerId} AND
            counterparty_type = 'wholesale' AND
            counterparty_role = 'buyer' AND
            product_type = 'kerosine' AND
            date_from <= ${dateStr} AND
            date_to >= ${dateStr} AND
            is_active = true
          `,
          columns: {
            id: true,
            priceValues: true,
            dateFrom: true,
            dateTo: true,
          },
        });

        result.salePrices = salePrices.map(p => ({
          id: p.id,
          values: (p.priceValues || []).map((v, idx) => {
            try {
              const parsed = JSON.parse(v);
              return {
                compositeId: `${p.id}-${idx}`,
                price: parsed.price,
                label: `${parsed.price} ₽/кг (${p.dateFrom} - ${p.dateTo})`,
              };
            } catch {
              return null;
            }
          }).filter(Boolean),
        })).filter(p => p.values.length > 0);
      }

      // Расчет стоимости доставки
      if (carrierId && deliveryLocationId && basis) {
        const deliveryCosts = await db.query.deliveryCost.findMany({
          where: sql`
            carrier_id = ${carrierId} AND
            to_entity_type = 'delivery_location' AND
            to_entity_id = ${deliveryLocationId} AND
            is_active = true
          `,
        });

        const bases = await db.query.bases.findMany({
          where: sql`name = ${basis} AND base_type = 'wholesale'`,
        });

        const baseId = bases[0]?.id;
        let cost = null;

        if (warehouseId) {
          cost = deliveryCosts.find(dc =>
            dc.fromEntityType === "warehouse" && dc.fromEntityId === warehouseId
          );
        }

        if (!cost && baseId) {
          cost = deliveryCosts.find(dc =>
            dc.fromEntityType === "base" && dc.fromEntityId === baseId
          );
        }

        if (cost) {
          result.deliveryCost = {
            costPerKg: cost.costPerKg,
            distance: cost.distance,
          };
        }
      }

      // Статус склада
      if (warehouseId) {
        const warehouse = await db.query.warehouses.findFirst({
          where: sql`id = ${warehouseId}`,
          columns: {
            currentBalance: true,
            averageCost: true,
          },
        });

        if (warehouse) {
          result.warehouseStatus = {
            balance: warehouse.currentBalance,
            averageCost: warehouse.averageCost,
          };
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching opt form options:", error);
      res.status(500).json({ message: "Ошибка получения данных формы" });
    }
  });

  // Получение списка доступных перевозчиков
  app.get("/api/opt/available-carriers", requireAuth, async (req, res) => {
    try {
      const { basis, warehouseId } = req.query;

      if (!basis) {
        return res.json([]);
      }

      const carriers = await db.query.logisticsCarriers.findMany({
        where: sql`is_active = true`,
      });

      // Фильтруем перевозчиков с доступными тарифами
      const deliveryCosts = await db.query.deliveryCost.findMany({
        where: sql`is_active = true`,
      });

      const bases = await db.query.bases.findMany({
        where: sql`name = ${basis} AND base_type = 'wholesale'`,
      });

      const baseId = bases[0]?.id;
      const availableCarrierIds = new Set<string>();

      deliveryCosts.forEach(dc => {
        const matchesSource =
          (warehouseId && dc.fromEntityType === "warehouse" && dc.fromEntityId === warehouseId) ||
          (baseId && dc.fromEntityType === "base" && dc.fromEntityId === baseId);

        if (matchesSource) {
          availableCarrierIds.add(dc.carrierId);
        }
      });

      const result = carriers.filter(c => availableCarrierIds.has(c.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching available carriers:", error);
      res.status(500).json({ message: "Ошибка получения перевозчиков" });
    }
  });

  // Получение списка доступных мест доставки
  app.get("/api/opt/available-delivery-locations", requireAuth, async (req, res) => {
    try {
      const { basis, warehouseId, carrierId } = req.query;

      if (!carrierId) {
        return res.json([]);
      }

      const locations = await db.query.logisticsDeliveryLocations.findMany({
        where: sql`is_active = true`,
      });

      const deliveryCosts = await db.query.deliveryCost.findMany({
        where: sql`carrier_id = ${carrierId} AND is_active = true`,
      });

      const bases = await db.query.bases.findMany({
        where: sql`name = ${basis} AND base_type = 'wholesale'`,
      });

      const baseId = bases[0]?.id;
      const availableLocationIds = new Set<string>();

      deliveryCosts.forEach(dc => {
        const matchesSource =
          (warehouseId && dc.fromEntityType === "warehouse" && dc.fromEntityId === warehouseId) ||
          (baseId && dc.fromEntityType === "base" && dc.fromEntityId === baseId);

        if (matchesSource && dc.toEntityType === "delivery_location") {
          availableLocationIds.add(dc.toEntityId);
        }
      });

      const result = locations.filter(l => availableLocationIds.has(l.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching available delivery locations:", error);
      res.status(500).json({ message: "Ошибка получения мест доставки" });
    }
  });
}
