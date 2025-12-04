
import type { Express } from "express";
import { storage } from "../storage";
import {
  insertCustomerSchema,
  insertWholesaleSupplierSchema,
  insertWholesaleBaseSchema,
  insertRefuelingProviderSchema,
  insertRefuelingBaseSchema,
  insertLogisticsCarrierSchema,
  insertLogisticsDeliveryLocationSchema,
  insertLogisticsVehicleSchema,
  insertLogisticsTrailerSchema,
  insertLogisticsDriverSchema,
  insertLogisticsWarehouseSchema,
} from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "./middleware";

export function registerDirectoriesRoutes(app: Express) {
  // ============ CUSTOMERS ============

  app.get("/api/customers", requireAuth, async (req, res) => {
    const module = req.query.module as string | undefined;
    const data = await storage.getAllCustomers(module);
    res.json(data);
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Неверный идентификатор" });
    }
    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: "Покупатель не найден" });
    }
    res.json(customer);
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const item = await storage.createCustomer(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания покупателя" });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Неверный идентификатор" });
      }
      const item = await storage.updateCustomer(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Покупатель не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления покупателя" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Неверный идентификатор" });
      }
      await storage.deleteCustomer(id);
      res.json({ message: "Покупатель удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления покупателя" });
    }
  });

  // ============ WHOLESALE SUPPLIERS ============

  app.get("/api/wholesale/suppliers", requireAuth, async (req, res) => {
    const data = await storage.getAllWholesaleSuppliers();
    res.json(data);
  });

  app.get("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const supplier = await storage.getWholesaleSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: "Поставщик не найден" });
    }
    res.json(supplier);
  });

  app.post("/api/wholesale/suppliers", requireAuth, async (req, res) => {
    try {
      const data = insertWholesaleSupplierSchema.parse(req.body);
      const item = await storage.createWholesaleSupplier(data);
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
      const id = parseInt(req.params.id);
      const item = await storage.updateWholesaleSupplier(id, req.body);
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
      const id = parseInt(req.params.id);
      await storage.deleteWholesaleSupplier(id);
      res.json({ message: "Поставщик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления поставщика" });
    }
  });

  // ============ WHOLESALE BASES ============

  app.get("/api/wholesale/bases", requireAuth, async (req, res) => {
    const supplierId = req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined;
    const data = await storage.getAllWholesaleBases(supplierId);
    res.json(data);
  });

  app.get("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const base = await storage.getWholesaleBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис не найден" });
    }
    res.json(base);
  });

  app.post("/api/wholesale/bases", requireAuth, async (req, res) => {
    try {
      const data = insertWholesaleBaseSchema.parse(req.body);
      const item = await storage.createWholesaleBase(data);
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
      const id = parseInt(req.params.id);
      const item = await storage.updateWholesaleBase(id, req.body);
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
      const id = parseInt(req.params.id);
      await storage.deleteWholesaleBase(id);
      res.json({ message: "Базис удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса" });
    }
  });

  // ============ REFUELING PROVIDERS ============

  app.get("/api/refueling/providers", requireAuth, async (req, res) => {
    const data = await storage.getAllRefuelingProviders();
    res.json(data);
  });

  app.get("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const provider = await storage.getRefuelingProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Аэропорт/Поставщик не найден" });
    }
    res.json(provider);
  });

  app.post("/api/refueling/providers", requireAuth, async (req, res) => {
    try {
      const data = insertRefuelingProviderSchema.parse(req.body);
      const item = await storage.createRefuelingProvider(data);
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
      const id = parseInt(req.params.id);
      const item = await storage.updateRefuelingProvider(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Аэропорт/Поставщик не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления аэропорта/поставщика" });
    }
  });

  app.delete("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRefuelingProvider(id);
      res.json({ message: "Аэропорт/Поставщик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления аэропорта/поставщика" });
    }
  });

  // ============ REFUELING BASES ============

  app.get("/api/refueling/bases", requireAuth, async (req, res) => {
    const providerId = req.query.providerId ? parseInt(req.query.providerId as string) : undefined;
    const data = await storage.getAllRefuelingBases(providerId);
    res.json(data);
  });

  app.get("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const base = await storage.getRefuelingBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис заправки не найден" });
    }
    res.json(base);
  });

  app.post("/api/refueling/bases", requireAuth, async (req, res) => {
    try {
      const data = insertRefuelingBaseSchema.parse(req.body);
      const item = await storage.createRefuelingBase(data);
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
      const id = parseInt(req.params.id);
      const item = await storage.updateRefuelingBase(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Базис заправки не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления базиса заправки" });
    }
  });

  app.delete("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRefuelingBase(id);
      res.json({ message: "Базис заправки удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса заправки" });
    }
  });

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
