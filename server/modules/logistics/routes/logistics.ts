import type { Express } from "express";
import { storage } from "../../../storage/index";
import {
  insertLogisticsCarrierSchema,
  insertLogisticsDeliveryLocationSchema,
  insertLogisticsVehicleSchema,
  insertLogisticsTrailerSchema,
  insertLogisticsDriverSchema,
} from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerLogisticsRoutes(app: Express) {
  // ============ LOGISTICS CARRIERS ============

  app.get(
    "/api/logistics/carriers",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      const data = await storage.logistics.getAllLogisticsCarriers();
      res.json(data);
    }
  );

  app.get(
    "/api/logistics/carriers/:id",
    requireAuth,
    requirePermission("directories", "view"),
    auditView(ENTITY_TYPES.LOGISTICS_CARRIER),
    async (req, res) => {
      const id = req.params.id;
      const carrier = await storage.logistics.getLogisticsCarrier(id);
      if (!carrier) {
        return res.status(404).json({ message: "Перевозчик не найден" });
      }
      res.json(carrier);
    }
  );

  app.post(
    "/api/logistics/carriers",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_CARRIER,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsCarrierSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.logistics.createLogisticsCarrier(data);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания перевозчика" });
      }
    }
  );

  app.patch(
    "/api/logistics/carriers/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_CARRIER,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsCarrier(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.logistics.updateLogisticsCarrier(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Перевозчик не найден" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления перевозчика" });
      }
    }
  );

  app.delete(
    "/api/logistics/carriers/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_CARRIER,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsCarrier(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.logistics.deleteLogisticsCarrier(id, req.session.userId);
        res.json({ message: "Перевозчик удален" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления перевозчика" });
      }
    }
  );

  // ============ LOGISTICS DELIVERY LOCATIONS ============

  app.get(
    "/api/logistics/delivery-locations",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      const data = await storage.logistics.getAllLogisticsDeliveryLocations();
      res.json(data);
    }
  );

  app.get(
    "/api/logistics/delivery-locations/:id",
    requireAuth,
    requirePermission("directories", "view"),
    auditView(ENTITY_TYPES.LOGISTICS_DELIVERY_LOCATION),
    async (req, res) => {
      const id = req.params.id;
      const location = await storage.logistics.getLogisticsDeliveryLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Место доставки не найдено" });
      }
      res.json(location);
    }
  );

  app.post(
    "/api/logistics/delivery-locations",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_DELIVERY_LOCATION,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsDeliveryLocationSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.logistics.createLogisticsDeliveryLocation(
          data
        );
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания места доставки" });
      }
    }
  );

  app.patch(
    "/api/logistics/delivery-locations/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_DELIVERY_LOCATION,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsDeliveryLocation(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.logistics.updateLogisticsDeliveryLocation(
          id,
          {
            ...req.body,
            updatedById: req.session.userId,
          }
        );
        if (!item) {
          return res.status(404).json({ message: "Место доставки не найдено" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления места доставки" });
      }
    }
  );

  app.delete(
    "/api/logistics/delivery-locations/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_DELIVERY_LOCATION,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsDeliveryLocation(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.logistics.deleteLogisticsDeliveryLocation(id, req.session.userId);
        res.json({ message: "Место доставки удалено" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления места доставки" });
      }
    }
  );

  // ============ LOGISTICS VEHICLES ============

  app.get(
    "/api/logistics/vehicles",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      const carrierId = req.query.carrierId as string | undefined;
      const data = await storage.logistics.getAllLogisticsVehicles(carrierId);
      res.json(data);
    }
  );

  app.get(
    "/api/logistics/vehicles/:id",
    requireAuth,
    requirePermission("directories", "view"),
    auditView(ENTITY_TYPES.LOGISTICS_VEHICLE),
    async (req, res) => {
      const id = req.params.id;
      const vehicle = await storage.logistics.getLogisticsVehicle(id);
      if (!vehicle) {
        return res.status(404).json({ message: "Транспорт не найден" });
      }
      res.json(vehicle);
    }
  );

  app.post(
    "/api/logistics/vehicles",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_VEHICLE,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsVehicleSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.logistics.createLogisticsVehicle(data);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания транспорта" });
      }
    }
  );

  app.patch(
    "/api/logistics/vehicles/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_VEHICLE,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsVehicle(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.logistics.updateLogisticsVehicle(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Транспорт не найден" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления транспорта" });
      }
    }
  );

  app.delete(
    "/api/logistics/vehicles/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_VEHICLE,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsVehicle(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.logistics.deleteLogisticsVehicle(id, req.session.userId);
        res.json({ message: "Транспорт удален" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления транспорта" });
      }
    }
  );

  // ============ LOGISTICS TRAILERS ============

  app.get(
    "/api/logistics/trailers",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      const carrierId = req.query.carrierId as string | undefined;
      const data = await storage.logistics.getAllLogisticsTrailers(carrierId);
      res.json(data);
    }
  );

  app.get(
    "/api/logistics/trailers/:id",
    requireAuth,
    requirePermission("directories", "view"),
    auditView(ENTITY_TYPES.LOGISTICS_TRAILER),
    async (req, res) => {
      const id = req.params.id;
      const trailer = await storage.logistics.getLogisticsTrailer(id);
      if (!trailer) {
        return res.status(404).json({ message: "Прицеп не найден" });
      }
      res.json(trailer);
    }
  );

  app.post(
    "/api/logistics/trailers",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_TRAILER,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsTrailerSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.logistics.createLogisticsTrailer(data);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания прицепа" });
      }
    }
  );

  app.patch(
    "/api/logistics/trailers/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_TRAILER,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsTrailer(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.logistics.updateLogisticsTrailer(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Прицеп не найден" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления прицепа" });
      }
    }
  );

  app.delete(
    "/api/logistics/trailers/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_TRAILER,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsTrailer(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.logistics.deleteLogisticsTrailer(id, req.session.userId);
        res.json({ message: "Прицеп удален" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления прицепа" });
      }
    }
  );

  // ============ LOGISTICS DRIVERS ============

  app.get(
    "/api/logistics/drivers",
    requireAuth,
    requirePermission("directories", "view"),
    async (req, res) => {
      const carrierId = req.query.carrierId as string | undefined;
      const data = await storage.logistics.getAllLogisticsDrivers(carrierId);
      res.json(data);
    }
  );

  app.get(
    "/api/logistics/drivers/:id",
    requireAuth,
    requirePermission("directories", "view"),
    auditView(ENTITY_TYPES.LOGISTICS_DRIVER),
    async (req, res) => {
      const id = req.params.id;
      const driver = await storage.logistics.getLogisticsDriver(id);
      if (!driver) {
        return res.status(404).json({ message: "Водитель не найден" });
      }
      res.json(driver);
    }
  );

  app.post(
    "/api/logistics/drivers",
    requireAuth,
    requirePermission("directories", "create"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_DRIVER,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const data = insertLogisticsDriverSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.logistics.createLogisticsDriver(data);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания водителя" });
      }
    }
  );

  app.patch(
    "/api/logistics/drivers/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_DRIVER,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsDriver(req.params.id);
      },
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.logistics.updateLogisticsDriver(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Водитель не найден" });
        }
        res.json(item);
      } catch (error) {
        res.status(500).json({ message: "Ошибка обновления водителя" });
      }
    }
  );

  app.delete(
    "/api/logistics/drivers/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.LOGISTICS_DRIVER,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => {
        return await storage.logistics.getLogisticsDriver(req.params.id);
      },
    }),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.logistics.deleteLogisticsDriver(id, req.session.userId);
        res.json({ message: "Водитель удален" });
      } catch (error) {
        res.status(500).json({ message: "Ошибка удаления водителя" });
      }
    }
  );
}
