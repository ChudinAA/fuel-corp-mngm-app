
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertGovernmentContractSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";

export function registerGovernmentContractRoutes(app: Express) {
  // Get government contracts
  app.get(
    "/api/gov-contracts",
    requireAuth,
    requirePermission("gov_contracts", "view"),
    async (req, res) => {
      try {
        const filters = {
          status: req.query.status as string | undefined,
          customerId: req.query.customerId as string | undefined,
        };
        const contracts = await storage.govContracts.getGovernmentContracts(filters);
        res.json(contracts);
      } catch (error) {
        console.error("Error fetching government contracts:", error);
        res.status(500).json({ message: "Ошибка получения госконтрактов" });
      }
    }
  );

  // Get single government contract
  app.get(
    "/api/gov-contracts/:id",
    requireAuth,
    requirePermission("gov_contracts", "view"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const contract = await storage.govContracts.getGovernmentContract(id);
        if (!contract) {
          return res.status(404).json({ message: "Контракт не найден" });
        }
        res.json(contract);
      } catch (error) {
        console.error("Error fetching government contract:", error);
        res.status(500).json({ message: "Ошибка получения контракта" });
      }
    }
  );

  // Create government contract
  app.post(
    "/api/gov-contracts",
    requireAuth,
    requirePermission("gov_contracts", "create"),
    async (req, res) => {
      try {
        const data = insertGovernmentContractSchema.parse({
          ...req.body,
          createdById: req.session.userId,
        });


  // Update contract from sales data
  app.post("/api/gov-contracts/:id/update-from-sales", requireAuth, requirePermission("reports", "edit"), logAudit, async (req, res) => {
    try {
      const result = await storage.govContracts.updateContractFromSales(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get contract completion status
  app.get("/api/gov-contracts/:id/completion-status", requireAuth, requirePermission("reports", "view"), async (req, res) => {
    try {
      const status = await storage.govContracts.getContractCompletionStatus(req.params.id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk update all active contracts
  app.post("/api/gov-contracts/bulk-update-from-sales", requireAuth, requirePermission("reports", "edit"), logAudit, async (req, res) => {
    try {
      const activeContracts = await storage.govContracts.getGovernmentContracts({ status: 'active' });
      
      const results = await Promise.all(
        activeContracts.map(contract => 
          storage.govContracts.updateContractFromSales(contract.id)
        )
      );

      res.json({ updated: results.length, results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

        const contract = await storage.govContracts.createGovernmentContract(data);
        res.status(201).json(contract);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error creating government contract:", error);
        res.status(500).json({ message: "Ошибка создания контракта" });
      }
    }
  );

  // Update government contract
  app.patch(
    "/api/gov-contracts/:id",
    requireAuth,
    requirePermission("gov_contracts", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const contract = await storage.govContracts.updateGovernmentContract(id, {
          ...req.body,
          updatedById: req.session.userId,
        });
        if (!contract) {
          return res.status(404).json({ message: "Контракт не найден" });
        }
        res.json(contract);
      } catch (error) {
        console.error("Error updating government contract:", error);
        res.status(500).json({ message: "Ошибка обновления контракта" });
      }
    }
  );

  // Update contract from sales data
  app.post(
    "/api/gov-contracts/:id/update-from-sales",
    requireAuth,
    requirePermission("gov_contracts", "edit"),
    async (req, res) => {
      try {
        const id = req.params.id;
        const contract = await storage.govContracts.updateContractFromSales(id);
        if (!contract) {
          return res.status(404).json({ message: "Контракт не найден" });
        }
        res.json(contract);
      } catch (error) {
        console.error("Error updating contract from sales:", error);
        res.status(500).json({ message: "Ошибка обновления данных контракта" });
      }
    }
  );

  // Delete government contract
  app.delete(
    "/api/gov-contracts/:id",
    requireAuth,
    requirePermission("gov_contracts", "delete"),
    async (req, res) => {
      try {
        const id = req.params.id;
        await storage.govContracts.deleteGovernmentContract(id, req.session.userId);
        res.json({ message: "Контракт удален" });
      } catch (error) {
        console.error("Error deleting government contract:", error);
        res.status(500).json({ message: "Ошибка удаления контракта" });
      }
    }
  );
}
