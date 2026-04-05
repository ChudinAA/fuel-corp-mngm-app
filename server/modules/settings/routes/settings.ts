import type { Express } from "express";
import { storage } from "../../../storage/index";
import { requireAuth } from "../../../middleware/middleware";

const BENEFICIARY_KEY = "beneficiary_name";

export function registerSettingsRoutes(app: Express) {
  app.get("/api/settings/beneficiary", requireAuth, async (req, res) => {
    const name = await storage.settings.get(BENEFICIARY_KEY);
    res.json({ name: name ?? "" });
  });

  app.put("/api/settings/beneficiary", requireAuth, async (req, res) => {
    const { name } = req.body as { name?: string };
    if (typeof name !== "string") {
      return res.status(400).json({ message: "name обязателен" });
    }
    await storage.settings.set(BENEFICIARY_KEY, name.trim());
    res.json({ name: name.trim() });
  });
}
