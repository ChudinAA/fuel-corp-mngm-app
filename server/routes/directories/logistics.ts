
import type { Express } from "express";
import { storage } from "../../storage";
import {
  insertLogisticsCarrierSchema,
  insertLogisticsDeliveryLocationSchema,
  insertLogisticsVehicleSchema,
  insertLogisticsTrailerSchema,
  insertLogisticsDriverSchema,
  insertLogisticsWarehouseSchema,
} from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "../middleware";

export function registerLogisticsRoutes(app: Express) {
  // ============ LOGISTICS CARRIERS ============

  app.get("/api/logistics/carriers", requireAuth, async (req, res) => {
    const data = await storage.getAllLogisticsCarriers();
    res.json(data);
  });

  app.get("/api/logistics/carriers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const carrier = await storage.getLogisticsCarrier(id);
    if (!carrier) {
      return res.status(404).json({ message: "Перевозчик не найден" });
    }
    res.json(carrier);
  });

  app.post("/api/logistics/carriers", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsCarrierSchema.parse(req.body);
      const item = await storage.createLogisticsCarrier(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания перевозчика" });
    }
  });

  app.patch("/api/logistics/carriers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsCarrier(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Перевозчик не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления перевозчика" });
    }
  });

  app.delete("/api/logistics/carriers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsCarrier(id);
      res.json({ message: "Перевозчик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления перевозчика" });
    }
  });

  // ============ LOGISTICS DELIVERY LOCATIONS ============

  app.get("/api/logistics/delivery-locations", requireAuth, async (req, res) => {
    const data = await storage.getAllLogisticsDeliveryLocations();
    res.json(data);
  });

  app.get("/api/logistics/delivery-locations/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const location = await storage.getLogisticsDeliveryLocation(id);
    if (!location) {
      return res.status(404).json({ message: "Место доставки не найдено" });
    }
    res.json(location);
  });

  app.post("/api/logistics/delivery-locations", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsDeliveryLocationSchema.parse(req.body);
      const item = await storage.createLogisticsDeliveryLocation(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания места доставки" });
    }
  });

  app.patch("/api/logistics/delivery-locations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsDeliveryLocation(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Место доставки не найдено" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления места доставки" });
    }
  });

  app.delete("/api/logistics/delivery-locations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsDeliveryLocation(id);
      res.json({ message: "Место доставки удалено" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления места доставки" });
    }
  });

  // ============ LOGISTICS VEHICLES ============

  app.get("/api/logistics/vehicles", requireAuth, async (req, res) => {
    const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
    const data = await storage.getAllLogisticsVehicles(carrierId);
    res.json(data);
  });

  app.get("/api/logistics/vehicles/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getLogisticsVehicle(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Транспорт не найден" });
    }
    res.json(vehicle);
  });

  app.post("/api/logistics/vehicles", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsVehicleSchema.parse(req.body);
      const item = await storage.createLogisticsVehicle(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания транспорта" });
    }
  });

  app.patch("/api/logistics/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsVehicle(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Транспорт не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления транспорта" });
    }
  });

  app.delete("/api/logistics/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsVehicle(id);
      res.json({ message: "Транспорт удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления транспорта" });
    }
  });

  // ============ LOGISTICS TRAILERS ============

  app.get("/api/logistics/trailers", requireAuth, async (req, res) => {
    const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
    const data = await storage.getAllLogisticsTrailers(carrierId);
    res.json(data);
  });

  app.get("/api/logistics/trailers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const trailer = await storage.getLogisticsTrailer(id);
    if (!trailer) {
      return res.status(404).json({ message: "Прицеп не найден" });
    }
    res.json(trailer);
  });

  app.post("/api/logistics/trailers", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsTrailerSchema.parse(req.body);
      const item = await storage.createLogisticsTrailer(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания прицепа" });
    }
  });

  app.patch("/api/logistics/trailers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsTrailer(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Прицеп не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления прицепа" });
    }
  });

  app.delete("/api/logistics/trailers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsTrailer(id);
      res.json({ message: "Прицеп удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления прицепа" });
    }
  });

  // ============ LOGISTICS DRIVERS ============

  app.get("/api/logistics/drivers", requireAuth, async (req, res) => {
    const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
    const data = await storage.getAllLogisticsDrivers(carrierId);
    res.json(data);
  });

  app.get("/api/logistics/drivers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await storage.getLogisticsDriver(id);
    if (!driver) {
      return res.status(404).json({ message: "Водитель не найден" });
    }
    res.json(driver);
  });

  app.post("/api/logistics/drivers", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsDriverSchema.parse(req.body);
      const item = await storage.createLogisticsDriver(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания водителя" });
    }
  });

  app.patch("/api/logistics/drivers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsDriver(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Водитель не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления водителя" });
    }
  });

  app.delete("/api/logistics/drivers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsDriver(id);
      res.json({ message: "Водитель удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления водителя" });
    }
  });

  // ============ LOGISTICS WAREHOUSES/BASES ============

  app.get("/api/logistics/warehouses", requireAuth, async (req, res) => {
    const data = await storage.getAllLogisticsWarehouses();
    res.json(data);
  });

  app.get("/api/logistics/warehouses/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const warehouse = await storage.getLogisticsWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ message: "Склад/Базис не найден" });
    }
    res.json(warehouse);
  });

  app.post("/api/logistics/warehouses", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsWarehouseSchema.parse(req.body);
      const item = await storage.createLogisticsWarehouse(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания склада/базиса" });
    }
  });

  app.patch("/api/logistics/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsWarehouse(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Склад/Базис не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления склада/базиса" });
    }
  });

  app.delete("/api/logistics/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsWarehouse(id);
      res.json({ message: "Склад/Базис удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления склада/базиса" });
    }
  });
}
