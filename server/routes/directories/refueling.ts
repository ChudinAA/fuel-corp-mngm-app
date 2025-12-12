import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertRefuelingProviderSchema, insertRefuelingBaseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerRefuelingDirectoryRoutes(app: Express) {
  // ============ REFUELING PROVIDERS ============

  app.get("/api/refueling/providers", requireAuth, async (req, res) => {
    const data = await storage.refueling.getAllRefuelingProviders();
    res.json(data);
  });

  app.get("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const provider = await storage.refueling.getRefuelingProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Аэропорт/Поставщик не найден" });
    }
    res.json(provider);
  });

  app.post("/api/refueling/providers", requireAuth, async (req, res) => {
    try {
      const data = insertRefuelingProviderSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.refueling.createRefuelingProvider(data);

      // Automatically create warehouse if provider is marked as warehouse
      if (data.isWarehouse && data.baseIds && data.baseIds.length > 0) {
        await storage.warehouses.createWarehouse({
          name: data.name,
          baseIds: data.baseIds,
          supplierType: "refueling",
          supplierId: item.id,
          storageCost: data.storageCost || null,
          isActive: data.isActive ?? true,
          createdById: req.session.userId,
        });
      }

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания аэропорта/поставщика" });
    }
  });

  app.patch("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      // Assuming storage.refueling.updateRefuelingProvider can handle the update
      // and returns the updated item or null if not found.
      // We might need to parse and validate req.body with insertRefuelingProviderSchema here as well
      // for consistency and security, similar to how POST is handled.
      const item = await storage.refueling.updateRefuelingProvider(id, {
        ...req.body,
        updatedAt: new Date(),
        updatedById: req.session.userId,
      });
      if (!item) {
        return res.status(404).json({ message: "Аэропорт/Поставщик не найден" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка обновления аэропорта/поставщика" });
    }
  });

  app.delete("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;

      // Check if provider has a warehouse
      const provider = await storage.refueling.getRefuelingProvider(id);
      if (provider?.isWarehouse) {
        // Find and deactivate the warehouse
        const warehouses = await storage.warehouses.getAllWarehouses();
        const linkedWarehouse = warehouses.find(w => w.supplierId === id && w.supplierType === "refueling");
        if (linkedWarehouse) {
          await storage.warehouses.updateWarehouse(linkedWarehouse.id, {
            isActive: false,
          });
        }
      }

      await storage.refueling.deleteRefuelingProvider(id);
      res.json({ message: "Провайдер удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления провайдера" });
    }
  });

  // ============ REFUELING BASES ============

  app.get("/api/refueling/bases", requireAuth, async (req, res) => {
    const providerId = req.query.providerId as string | undefined;
    const data = await storage.refueling.getAllRefuelingBases(providerId);
    res.json(data);
  });

  app.get("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const base = await storage.refueling.getRefuelingBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис заправки не найден" });
    }
    res.json(base);
  });

  app.post("/api/refueling/bases", requireAuth, async (req, res) => {
    try {
      const data = insertRefuelingBaseSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.refueling.createRefuelingBase(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания базиса заправки" });
    }
  });

  app.patch("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      // Similar to providers, validate and parse req.body
      const item = await storage.refueling.updateRefuelingBase(id, {
        ...req.body,
        updatedAt: new Date(),
        updatedById: req.session.userId,
      });
      if (!item) {
        return res.status(404).json({ message: "Базис заправки не найден" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка обновления базиса заправки" });
    }
  });

  app.delete("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.refueling.deleteRefuelingBase(id);
      res.json({ message: "Базис заправки удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса заправки" });
    }
  });
}