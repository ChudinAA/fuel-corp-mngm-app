
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertSavedReportSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerReportsRoutes(app: Express) {
  // Get saved reports
  app.get(
    "/api/reports/saved",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const userId = req.session.userId!;
        const reportType = req.query.reportType as string | undefined;
        const reports = await storage.reports.getSavedReports(userId, reportType);
        res.json(reports);


  // Generate custom period report
  app.post("/api/reports/custom-period", requireAuth, requirePermission("reports", "view"), async (req, res) => {
    try {
      const { startDate, endDate, reportTypes } = req.body;
      
      if (!startDate || !endDate || !reportTypes || !Array.isArray(reportTypes)) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const report = await storage.reports.generateCustomPeriodReport(startDate, endDate, reportTypes);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

      } catch (error) {
        console.error("Error fetching saved reports:", error);
        res.status(500).json({ message: "Ошибка получения сохраненных отчетов" });
      }
    }
  );

  // Get single saved report
  app.get(
    "/api/reports/saved/:id",
    requireAuth,
    requirePermission("reports", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const report = await storage.reports.getSavedReport(id);
        if (!report) {
          return res.status(404).json({ message: "Отчет не найден" });
        }
        res.json(report);
      } catch (error) {
        console.error("Error fetching saved report:", error);
        res.status(500).json({ message: "Ошибка получения отчета" });
      }
    }
  );

  // Create saved report
  app.post(
    "/api/reports/saved",
    requireAuth,
    requirePermission("reports", "create"),
    async (req, res) => {
      try {
        const data = insertSavedReportSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const report = await storage.reports.createSavedReport(data);
        res.status(201).json(report);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating saved report:", error);
        res.status(500).json({ message: "Ошибка создания отчета" });
      }
    }
  );

  // Update saved report
  app.patch(
    "/api/reports/saved/:id",
    requireAuth,
    requirePermission("reports", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const report = await storage.reports.updateSavedReport(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!report) {
          return res.status(404).json({ message: "Отчет не найден" });
        }
        res.json(report);
      } catch (error) {
        console.error("Error updating saved report:", error);
        res.status(500).json({ message: "Ошибка обновления отчета" });
      }
    }
  );

  // Delete saved report
  app.delete(
    "/api/reports/saved/:id",
    requireAuth,
    requirePermission("reports", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.reports.deleteSavedReport(id, req.session.userId);
        res.json({ message: "Отчет удален" });
      } catch (error) {
        console.error("Error deleting saved report:", error);
        res.status(500).json({ message: "Ошибка удаления отчета" });
      }
    }
  );
}
