
import type { Express } from "express";

// Old wholesale routes are deprecated
// Use unified /api/directories/suppliers and /api/directories/bases instead
export function registerWholesaleRoutes(app: Express) {
  // Routes removed - use unified endpoints at /api/directories/suppliers and /api/directories/bases

  /* Removed - use /api/directories/suppliers/:id
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
      const data = insertWholesaleSupplierSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.wholesale.createWholesaleSupplier(data);
      
      // Automatically create warehouse if supplier is marked as warehouse
      if (data.isWarehouse && data.baseIds && data.baseIds.length > 0) {
        await storage.warehouses.createWarehouse({
          name: data.name,
          baseIds: data.baseIds,
          supplierType: "wholesale",
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
      res.status(500).json({ message: "Ошибка создания поставщика" });
    }
  });

  app.patch("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const item = await storage.wholesale.updateWholesaleSupplier(id, {
        ...req.body,
        updatedById: req.session.userId,
      });
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
      
      // Check if supplier has a warehouse
      const supplier = await storage.wholesale.getWholesaleSupplier(id);
      if (supplier?.isWarehouse) {
        // Find and deactivate the warehouse
        const warehouses = await storage.warehouses.getAllWarehouses();
        const linkedWarehouse = warehouses.find(w => w.supplierId === id && w.supplierType === "wholesale");
        if (linkedWarehouse) {
          await storage.warehouses.updateWarehouse(linkedWarehouse.id, {
            isActive: false,
          });
        }
      }
      
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
      const data = insertWholesaleBaseSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
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
      const item = await storage.wholesale.updateWholesaleBase(id, {
        ...req.body,
        updatedById: req.session.userId,
      });
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
