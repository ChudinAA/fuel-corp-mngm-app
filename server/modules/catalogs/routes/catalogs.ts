import type { Express } from "express";
import { storage } from "../../../storage";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog } from "../../audit/middleware/audit-middleware";
import { AUDIT_OPERATIONS, ENTITY_TYPES } from "../../audit/entities/audit";
import {
  counterpartyContractBaseSchema,
  insertCounterpartyContractSchema,
  insertNomenclatureSchema,
  insertNomenclatureTypeSchema,
  insertUnitOfMeasureSchema,
} from "../entities";
import { z } from "zod";

export function registerCatalogRoutes(app: Express) {
  const view = requirePermission("directories", "view");
  const create = requirePermission("directories", "create");
  const edit = requirePermission("directories", "edit");
  const remove = requirePermission("directories", "delete");

  app.get("/api/contracts", requireAuth, view, async (req, res) => {
    try {
      res.json(await storage.catalogs.getContracts({
        supplierId: req.query.supplierId as string | undefined,
        buyerId: req.query.buyerId as string | undefined,
        carrierId: req.query.carrierId as string | undefined,
      }));
    } catch (error) {
      console.error("Get contracts failed:", error);
      res.status(500).json({ message: "Не удалось загрузить договоры" });
    }
  });
  app.post("/api/contracts", requireAuth, create, auditLog({
    entityType: ENTITY_TYPES.CONTRACT,
    operation: AUDIT_OPERATIONS.CREATE,
    getNewData: (req) => req.body,
  }), async (req, res) => {
    try {
      const data = insertCounterpartyContractSchema.parse({ ...req.body, createdById: req.session.userId });
      if (data.parentContractId) {
        const parent = await storage.catalogs.getContract(data.parentContractId);
        if (!parent || parent.parentContractId || parent.supplierId !== (data.supplierId ?? null) || parent.buyerId !== (data.buyerId ?? null) || parent.carrierId !== (data.carrierId ?? null)) {
          return res.status(400).json({ message: "Приложение должно быть связано с основным договором того же контрагента" });
        }
      }
      res.status(201).json(await storage.catalogs.createContract(data));
    } catch (error: any) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof z.ZodError ? error.errors[0]?.message : "Не удалось создать договор" });
    }
  });
  app.patch("/api/contracts/:id", requireAuth, edit, auditLog({
    entityType: ENTITY_TYPES.CONTRACT,
    operation: AUDIT_OPERATIONS.UPDATE,
    getOldData: (req) => storage.catalogs.getContract(req.params.id),
    getNewData: (req) => req.body,
  }), async (req, res) => {
    try {
      const data = counterpartyContractBaseSchema.partial().parse({ ...req.body, updatedById: req.session.userId });
      if (data.parentContractId) {
        const parent = await storage.catalogs.getContract(data.parentContractId);
        const current = await storage.catalogs.getContract(req.params.id);
        const supplierId = data.supplierId ?? current?.supplierId;
        const buyerId = data.buyerId ?? current?.buyerId;
        const carrierId = data.carrierId ?? current?.carrierId;
        if (!parent || parent.parentContractId || parent.supplierId !== supplierId || parent.buyerId !== buyerId || parent.carrierId !== carrierId) {
          return res.status(400).json({ message: "Приложение должно быть связано с основным договором того же контрагента" });
        }
      }
      const item = await storage.catalogs.updateContract(req.params.id, data);
      if (!item) return res.status(404).json({ message: "Договор не найден" });
      res.json(item);
    } catch (error: any) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof z.ZodError ? error.errors[0]?.message : "Не удалось обновить договор" });
    }
  });
  app.delete("/api/contracts/:id", requireAuth, remove, auditLog({
    entityType: ENTITY_TYPES.CONTRACT,
    operation: AUDIT_OPERATIONS.DELETE,
    getOldData: (req) => storage.catalogs.getContract(req.params.id),
  }), async (req, res) => {
    const item = await storage.catalogs.deleteContract(req.params.id, String(req.session.userId));
    if (!item) return res.status(404).json({ message: "Договор не найден" });
    res.json(item);
  });

  app.get("/api/nomenclature-types", requireAuth, view, async (_req, res) => res.json(await storage.catalogs.getNomenclatureTypes()));
  app.get("/api/units-of-measure", requireAuth, view, async (_req, res) => res.json(await storage.catalogs.getUnits()));
  app.get("/api/nomenclature", requireAuth, view, async (req, res) => {
    res.json(await storage.catalogs.getNomenclature(req.query.typeCode as string | undefined));
  });

  registerSimpleCatalog(app, {
    path: "/api/nomenclature-types",
    entityType: ENTITY_TYPES.NOMENCLATURE_TYPE,
    parse: insertNomenclatureTypeSchema,
    get: (id) => storage.catalogs.getNomenclatureType(id),
    create: (data) => storage.catalogs.createType(data),
    update: (id, data) => storage.catalogs.updateType(id, data),
    delete: (id, userId) => storage.catalogs.deleteType(id, userId),
  });
  registerSimpleCatalog(app, {
    path: "/api/units-of-measure",
    entityType: ENTITY_TYPES.UNIT_OF_MEASURE,
    parse: insertUnitOfMeasureSchema,
    get: (id) => storage.catalogs.getUnit(id),
    create: (data) => storage.catalogs.createUnit(data),
    update: (id, data) => storage.catalogs.updateUnit(id, data),
    delete: (id, userId) => storage.catalogs.deleteUnit(id, userId),
  });
  registerSimpleCatalog(app, {
    path: "/api/nomenclature",
    entityType: ENTITY_TYPES.NOMENCLATURE,
    parse: insertNomenclatureSchema,
    get: (id) => storage.catalogs.getNomenclatureItem(id),
    create: (data) => storage.catalogs.createNomenclature(data),
    update: (id, data) => storage.catalogs.updateNomenclature(id, data),
    delete: (id, userId) => storage.catalogs.deleteNomenclature(id, userId),
  });
}

function registerSimpleCatalog(app: Express, config: {
  path: string;
  entityType: any;
  parse: z.AnyZodObject;
  get: (id: string) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string, userId: string) => Promise<any>;
}) {
  app.post(config.path, requireAuth, requirePermission("directories", "create"), auditLog({
    entityType: config.entityType,
    operation: AUDIT_OPERATIONS.CREATE,
    getNewData: (req) => req.body,
  }), async (req, res) => {
    try {
      const data = config.parse.parse({ ...req.body, createdById: req.session.userId });
      res.status(201).json(await config.create(data));
    } catch (error: any) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof z.ZodError ? error.errors[0]?.message : "Не удалось создать запись справочника" });
    }
  });
  app.patch(`${config.path}/:id`, requireAuth, requirePermission("directories", "edit"), auditLog({
    entityType: config.entityType,
    operation: AUDIT_OPERATIONS.UPDATE,
    getOldData: (req) => config.get(req.params.id),
    getNewData: (req) => req.body,
  }), async (req, res) => {
    try {
      const data = config.parse.partial().parse({ ...req.body, updatedById: req.session.userId });
      const item = await config.update(req.params.id, data);
      if (!item) return res.status(404).json({ message: "Запись не найдена" });
      res.json(item);
    } catch (error: any) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error instanceof z.ZodError ? error.errors[0]?.message : "Не удалось обновить запись справочника" });
    }
  });
  app.delete(`${config.path}/:id`, requireAuth, requirePermission("directories", "delete"), auditLog({
    entityType: config.entityType,
    operation: AUDIT_OPERATIONS.DELETE,
    getOldData: (req) => config.get(req.params.id),
  }), async (req, res) => {
    try {
      const item = await config.delete(req.params.id, String(req.session.userId));
      if (!item) return res.status(404).json({ message: "Запись не найдена" });
      res.json(item);
    } catch (error) {
      res.status(409).json({ message: error instanceof Error ? error.message : "Не удалось удалить запись" });
    }
  });
}
