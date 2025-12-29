
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertRegistryTemplateSchema } from "../entities/registries";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerRegistriesRoutes(app: Express) {
  // Get registry templates
  app.get(
    "/api/registries/templates",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const templateType = req.query.templateType as string | undefined;
        const templates = await storage.registries.getRegistryTemplates(templateType);
        res.json(templates);
      } catch (error) {
        console.error("Error fetching registry templates:", error);
        res.status(500).json({ message: "Ошибка получения шаблонов реестров" });
      }
    }
  );

  // Get single registry template
  app.get(
    "/api/registries/templates/:id",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const template = await storage.registries.getRegistryTemplate(id);
        if (!template) {
          return res.status(404).json({ message: "Шаблон не найден" });
        }
        res.json(template);
      } catch (error) {
        console.error("Error fetching registry template:", error);
        res.status(500).json({ message: "Ошибка получения шаблона" });
      }
    }
  );

  // Create registry template
  app.post(
    "/api/registries/templates",
    requireAuth,
    requirePermission("reports", "create"),
    async (req, res) => {
      try {
        const data = insertRegistryTemplateSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const template = await storage.registries.createRegistryTemplate(data);
        res.status(201).json(template);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating registry template:", error);
        res.status(500).json({ message: "Ошибка создания шаблона" });
      }
    }
  );

  // Update registry template
  app.patch(
    "/api/registries/templates/:id",
    requireAuth,
    requirePermission("reports", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const template = await storage.registries.updateRegistryTemplate(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!template) {
          return res.status(404).json({ message: "Шаблон не найден" });
        }
        res.json(template);
      } catch (error) {
        console.error("Error updating registry template:", error);
        res.status(500).json({ message: "Ошибка обновления шаблона" });
      }
    }
  );

  // Delete registry template
  app.delete(
    "/api/registries/templates/:id",
    requireAuth,
    requirePermission("reports", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.registries.deleteRegistryTemplate(id, req.session.userId);
        res.json({ message: "Шаблон удален" });
      } catch (error) {
        console.error("Error deleting registry template:", error);
        res.status(500).json({ message: "Ошибка удаления шаблона" });
      }
    }
  );
}
