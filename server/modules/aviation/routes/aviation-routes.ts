import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertAircraftSchema, insertFlightNumberSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerAviationRoutes(app: Express) {
  // ============ AIRCRAFT ============

  app.get(
    "/api/aircraft",
    requireAuth,
    async (req, res) => {
      const data = await storage.aviation.getAllAircraft();
      res.json(data);
    }
  );

  app.post(
    "/api/aircraft",
    requireAuth,
    requirePermission("directories", "create"),
    async (req, res) => {
      try {
        const data = insertAircraftSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.aviation.createAircraft(data);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания борта" });
      }
    }
  );

  app.patch(
    "/api/aircraft/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.aviation.updateAircraft(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Борт не найден" });
        }
        res.json(item);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка обновления борта" });
      }
    }
  );

  app.delete(
    "/api/aircraft/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.aviation.deleteAircraft(id, req.session.userId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления борта" });
      }
    }
  );

  // ============ FLIGHT NUMBERS ============

  app.get(
    "/api/flight-numbers",
    requireAuth,
    async (req, res) => {
      const basisId = req.query.basisId as string | undefined;
      const data = await storage.aviation.getAllFlightNumbers(basisId);
      res.json(data);
    }
  );

  app.post(
    "/api/flight-numbers",
    requireAuth,
    requirePermission("directories", "create"),
    async (req, res) => {
      try {
        const data = insertFlightNumberSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const item = await storage.aviation.createFlightNumber(data);
        res.status(201).json(item);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error.message === "Такая запись уже существует") {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Ошибка создания номера рейса" });
      }
    }
  );

  app.patch(
    "/api/flight-numbers/:id",
    requireAuth,
    requirePermission("directories", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const item = await storage.aviation.updateFlightNumber(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!item) {
          return res.status(404).json({ message: "Номер рейса не найден" });
        }
        res.json(item);
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка обновления номера рейса" });
      }
    }
  );

  app.delete(
    "/api/flight-numbers/:id",
    requireAuth,
    requirePermission("directories", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.aviation.deleteFlightNumber(id, req.session.userId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ message: "Ошибка удаления номера рейса" });
      }
    }
  );
}
