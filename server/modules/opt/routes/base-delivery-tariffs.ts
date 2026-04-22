import type { Express } from "express";
import { requireAuth } from "../../../middleware/middleware";
import { baseDeliveryTariffsStorage } from "../storage/base-delivery-tariffs-storage";
import { insertBaseDeliveryTariffSchema } from "../entities/base-delivery-tariffs";

export function registerBaseDeliveryTariffsRoutes(app: Express) {
  app.get("/api/base-delivery-tariffs", requireAuth, async (req, res) => {
    try {
      const tariffs = await baseDeliveryTariffsStorage.getAll();
      res.json(tariffs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/base-delivery-tariffs/lookup", requireAuth, async (req, res) => {
    try {
      const { fromBaseId, toBaseId } = req.query as { fromBaseId?: string; toBaseId?: string };
      if (!fromBaseId || !toBaseId) {
        return res.status(400).json({ message: "fromBaseId and toBaseId required" });
      }
      const tariff = await baseDeliveryTariffsStorage.getByBasePair(fromBaseId, toBaseId);
      res.json(tariff ?? null);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/base-delivery-tariffs/:id", requireAuth, async (req, res) => {
    try {
      const tariff = await baseDeliveryTariffsStorage.getById(req.params.id);
      if (!tariff) return res.status(404).json({ message: "Not found" });
      res.json(tariff);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/base-delivery-tariffs", requireAuth, async (req, res) => {
    try {
      const parsed = insertBaseDeliveryTariffSchema.parse(req.body);
      const tariff = await baseDeliveryTariffsStorage.create(parsed);
      res.status(201).json(tariff);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/base-delivery-tariffs/:id", requireAuth, async (req, res) => {
    try {
      const parsed = insertBaseDeliveryTariffSchema.partial().parse(req.body);
      const tariff = await baseDeliveryTariffsStorage.update(req.params.id, parsed);
      if (!tariff) return res.status(404).json({ message: "Not found" });
      res.json(tariff);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/base-delivery-tariffs/:id", requireAuth, async (req, res) => {
    try {
      await baseDeliveryTariffsStorage.delete(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
