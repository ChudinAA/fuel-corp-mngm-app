import { Router } from "express";
import { equipmentStorage } from "../storage/equipment-storage";
import { insertEquipmentSchema } from "../entities/equipment";

export function registerEquipmentRoutes(app: Router) {
  const router = Router();

  router.get("/", async (req, res) => {
    const data = await equipmentStorage.getEquipments();
    res.json(data);
  });

  router.get("/:id", async (req, res) => {
    const data = await equipmentStorage.getEquipment(req.params.id);
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  router.post("/", async (req, res) => {
    const parsed = insertEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const data = await equipmentStorage.createEquipment(parsed.data);
    res.status(201).json(data);
  });

  router.patch("/:id", async (req, res) => {
    const data = await equipmentStorage.updateEquipment(req.params.id, req.body);
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  router.delete("/:id", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    await equipmentStorage.deleteEquipment(req.params.id, (req.user as any).id);
    res.status(204).end();
  });

  router.get("/:id/transactions", async (req, res) => {
    const data = await equipmentStorage.getTransactions(req.params.id);
    res.json(data);
  });

  app.use("/api/warehouses-equipment", router);
}
