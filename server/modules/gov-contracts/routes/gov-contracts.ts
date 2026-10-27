
import type { Express } from "express";
import { storage } from "../../../storage/index";
import { insertGovernmentContractSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

class InvalidContractVolumeError extends Error {}

function storedKilogramsToTonnes(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const kilograms = Number(value);
  if (!Number.isFinite(kilograms)) {
    throw new TypeError("Government contract mass must be a finite kilogram value");
  }
  return kilogramsToTonnes(kilograms);
}

function governmentContractToApi<
  T extends { plannedVolume?: string | null; actualVolume?: string | null },
>(contract: T) {
  const { plannedVolume, actualVolume, ...fields } = contract;
  return {
    ...fields,
    plannedVolumeTonnes: storedKilogramsToTonnes(plannedVolume),
    actualVolumeTonnes: storedKilogramsToTonnes(actualVolume),
  };
}

function contractInputToLegacy(data: Record<string, unknown>) {
  const { plannedVolumeTonnes, ...fields } = data;
  if (plannedVolumeTonnes === undefined) return fields;
  if (plannedVolumeTonnes === null || plannedVolumeTonnes === "") {
    return { ...fields, plannedVolume: "" };
  }

  const tonnes = Number(plannedVolumeTonnes);
  if (!Number.isFinite(tonnes) || tonnes < 0) {
    throw new InvalidContractVolumeError("Плановый объем должен быть неотрицательным значением в тоннах");
  }

  return { ...fields, plannedVolume: String(tonnesToKilograms(tonnes)) };
}

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
        res.json(contracts.map(governmentContractToApi));
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
        res.json(governmentContractToApi(contract));
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
          ...contractInputToLegacy(req.body),
          createdById: req.session.userId,
        });

        const contract = await storage.govContracts.createGovernmentContract(data);
        res.status(201).json(governmentContractToApi(contract));
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        if (error instanceof InvalidContractVolumeError) {
          return res.status(400).json({ message: error.message });
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
          ...contractInputToLegacy(req.body),
          updatedById: req.session.userId,
        });
        if (!contract) {
          return res.status(404).json({ message: "Контракт не найден" });
        }
        res.json(governmentContractToApi(contract));
      } catch (error) {
        if (error instanceof InvalidContractVolumeError) {
          return res.status(400).json({ message: error.message });
        }
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
        const result = await storage.govContracts.updateContractFromSales(id);
        res.json(result);
      } catch (error: any) {
        console.error("Error updating contract from sales:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  // Get contract completion status
  app.get(
    "/api/gov-contracts/:id/completion-status",
    requireAuth,
    requirePermission("gov_contracts", "view"),
    async (req, res) => {
      try {
        const status = await storage.govContracts.getContractCompletionStatus(req.params.id);
        res.json(status);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    }
  );

  // Bulk update all active contracts
  app.post(
    "/api/gov-contracts/bulk-update-from-sales",
    requireAuth,
    requirePermission("gov_contracts", "edit"),
    async (req, res) => {
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
