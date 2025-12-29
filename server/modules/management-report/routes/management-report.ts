
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertManagementReportSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerManagementReportRoutes(app: Express) {
  // Get management reports
  app.get(
    "/api/management-report",
    requireAuth,
    requirePermission("management_report", "view"),
    async (req, res) => {
      try {
        const filters = {
          startDate: req.query.startDate as string | undefined,
          endDate: req.query.endDate as string | undefined,
        };
        const reports = await storage.managementReport.getManagementReports(filters);
        res.json(reports);
      } catch (error) {
        console.error("Error fetching management reports:", error);
        res.status(500).json({ message: "Ошибка получения управленческих отчетов" });
      }
    }
  );

  // Get single management report
  app.get(
    "/api/management-report/:id",
    requireAuth,
    requirePermission("management_report", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const report = await storage.managementReport.getManagementReport(id);
        if (!report) {
          return res.status(404).json({ message: "Отчет не найден" });
        }
        res.json(report);
      } catch (error) {
        console.error("Error fetching management report:", error);
        res.status(500).json({ message: "Ошибка получения отчета" });
      }
    }
  );

  // Generate management report data


  // Generate and save management report
  app.post("/api/management-reports/generate", requireAuth, requirePermission("reports", "create"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { reportName, periodStart, periodEnd, description, visualizationConfig } = req.body;

      if (!reportName || !periodStart || !periodEnd) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Генерируем данные
      const reportData = await storage.managementReport.generateManagementReportData(periodStart, periodEnd);

      // Сохраняем отчет
      const report = await storage.managementReport.createManagementReport({
        reportName,
        description,
        periodStart,
        periodEnd,
        reportData,
        visualizationConfig: visualizationConfig || null,
        createdById: userId,
      });

      res.status(201).json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update visualization config
  app.patch("/api/management-reports/:id/visualization", requireAuth, requirePermission("reports", "edit"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { visualizationConfig } = req.body;

      const updated = await storage.managementReport.updateManagementReport(req.params.id, {
        visualizationConfig,
        updatedById: userId,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate report data
  app.post("/api/management-reports/:id/regenerate", requireAuth, requirePermission("reports", "edit"), logAudit, async (req, res) => {
    try {
      const userId = req.user!.id;
      const report = await storage.managementReport.getManagementReport(req.params.id);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      const reportData = await storage.managementReport.generateManagementReportData(
        report.periodStart,
        report.periodEnd
      );

      const updated = await storage.managementReport.updateManagementReport(req.params.id, {
        reportData,
        updatedById: userId,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/management-report/generate",
    requireAuth,
    requirePermission("management_report", "view"),
    async (req, res) => {
      try {
        const { periodStart, periodEnd } = req.body;
        if (!periodStart || !periodEnd) {
          return res.status(400).json({ message: "Не указаны даты периода" });
        }
        const reportData = await storage.managementReport.generateManagementReportData(periodStart, periodEnd);
        res.json(reportData);
      } catch (error) {
        console.error("Error generating management report data:", error);
        res.status(500).json({ message: "Ошибка генерации данных отчета" });
      }
    }
  );

  // Create management report
  app.post(
    "/api/management-report",
    requireAuth,
    requirePermission("management_report", "create"),
    async (req, res) => {
      try {
        const data = insertManagementReportSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });
        const report = await storage.managementReport.createManagementReport(data);
        res.status(201).json(report);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating management report:", error);
        res.status(500).json({ message: "Ошибка создания отчета" });
      }
    }
  );

  // Update management report
  app.patch(
    "/api/management-report/:id",
    requireAuth,
    requirePermission("management_report", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const report = await storage.managementReport.updateManagementReport(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!report) {
          return res.status(404).json({ message: "Отчет не найден" });
        }
        res.json(report);
      } catch (error) {
        console.error("Error updating management report:", error);
        res.status(500).json({ message: "Ошибка обновления отчета" });
      }
    }
  );

  // Delete management report
  app.delete(
    "/api/management-report/:id",
    requireAuth,
    requirePermission("management_report", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.managementReport.deleteManagementReport(id, req.session.userId);
        res.json({ message: "Отчет удален" });
      } catch (error) {
        console.error("Error deleting management report:", error);
        res.status(500).json({ message: "Ошибка удаления отчета" });
      }
    }
  );
}
