import { Router } from "express";
import { equipmentStorage } from "../storage/equipment-storage";
import { insertEquipmentSchema } from "../entities/equipment";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { auditLog, auditView } from "../../audit/middleware/audit-middleware";
import { ENTITY_TYPES, AUDIT_OPERATIONS } from "../../audit/entities/audit";

export function registerEquipmentRoutes(app: Router) {
  const router = Router();

  router.get("/", requireAuth, requirePermission("refueling", "view"), async (req, res) => {
    const data = await equipmentStorage.getEquipments();
    res.json(data);
  });

  router.get("/:id", requireAuth, requirePermission("refueling", "view"), async (req, res) => {
    const data = await equipmentStorage.getEquipment(req.params.id);
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  router.post("/", 
    requireAuth, 
    requirePermission("refueling", "create"),
    auditLog({
      entityType: ENTITY_TYPES.EQUIPMENT,
      operation: AUDIT_OPERATIONS.CREATE,
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      const { warehouseId, ...equipmentData } = req.body;
      const parsed = insertEquipmentSchema.safeParse(equipmentData);
      if (!parsed.success) return res.status(400).json(parsed.error);
      
      const data = await equipmentStorage.createEquipment({
        ...parsed.data,
        createdById: (req.user as any).id
      });
      
      if (warehouseId) {
        await equipmentStorage.linkToWarehouse(warehouseId, data.id);
      }
      
      res.status(201).json(data);
    }
  );

  router.patch("/:id", 
    requireAuth, 
    requirePermission("refueling", "edit"),
    auditLog({
      entityType: ENTITY_TYPES.EQUIPMENT,
      operation: AUDIT_OPERATIONS.UPDATE,
      getOldData: async (req) => equipmentStorage.getEquipment(req.params.id),
      getNewData: (req) => req.body,
    }),
    async (req, res) => {
      const data = await equipmentStorage.updateEquipment(req.params.id, {
        ...req.body,
        updatedById: (req.user as any).id
      });
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    }
  );

  router.delete("/:id", 
    requireAuth, 
    requirePermission("refueling", "delete"),
    auditLog({
      entityType: ENTITY_TYPES.EQUIPMENT,
      operation: AUDIT_OPERATIONS.DELETE,
      getOldData: async (req) => equipmentStorage.getEquipment(req.params.id),
    }),
    async (req, res) => {
      await equipmentStorage.deleteEquipment(req.params.id, (req.user as any).id);
      res.status(204).end();
    }
  );

  router.get("/:id/transactions", requireAuth, requirePermission("refueling", "view"), async (req, res) => {
    const data = await equipmentStorage.getTransactions(req.params.id);
    res.json(data);
  });

  app.use("/api/warehouses-equipment", router);
}
