
import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertWholesaleSupplierSchema, insertWholesaleBaseSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerWholesaleRoutes(app: Express) {
  // ============ WHOLESALE SUPPLIERS ============

  app.get("/api/wholesale/suppliers", requireAuth, async (req, res) => {
    const data = await storage.wholesale.getAllWholesaleSuppliers();
    res.json(data);
  });

  app.get("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const supplier = await storage.wholesale.getWholesaleSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: "Поставщик не найден" });
    }
    res.json(supplier);
  });

  app.post("/api/wholesale/suppliers", requireAuth, async (req, res) => {
    try {
      const data = insertWholesaleSupplierSchema.parse(req.body);
      const item = await storage.wholesale.createWholesaleSupplier(data);
      
      // Automatically create warehouse if supplier is marked as warehouse
      if (data.isWarehouse && data.baseIds && data.baseIds.length > 0) {
        await storage.operations.createWarehouse({
          name: data.name,
          baseIds: data.baseIds,
          supplierType: "wholesale",
          supplierId: item.id,
          storageCost: data.storageCost || null,
          isActive: data.isActive ?? true,
        });
      }
      
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания поставщика" });
    }
  });

  app.patch("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.wholesale.updateWholesaleSupplier(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Поставщик не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления поставщика" });
    }
  });

  app.delete("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.wholesale.deleteWholesaleSupplier(id);
      res.json({ message: "Поставщик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления поставщика" });
    }
  });

  // ============ WHOLESALE BASES ============

  app.get("/api/wholesale/bases", requireAuth, async (req, res) => {
    const supplierId = req.query.supplierId as string | undefined;
    const data = await storage.wholesale.getAllWholesaleBases(supplierId);
    res.json(data);
  });

  app.get("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    const id = req.params.id;
    const base = await storage.wholesale.getWholesaleBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис не найден" });
    }
    res.json(base);
  });

  app.post("/api/wholesale/bases", requireAuth, async (req, res) => {
    try {
      const data = insertWholesaleBaseSchema.parse(req.body);
      const item = await storage.wholesale.createWholesaleBase(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания базиса" });
    }
  });

  app.patch("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.wholesale.updateWholesaleBase(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Базис не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления базиса" });
    }
  });

  app.delete("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      await storage.wholesale.deleteWholesaleBase(id);
      res.json({ message: "Базис удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса" });
    }
  });
}
