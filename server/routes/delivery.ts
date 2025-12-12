
import type { Express, Request, Response } from "express";
import { insertDeliveryCostSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "./middleware";
import { db } from "../db";
import { deliveryCost } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerDeliveryRoutes(app: Express) {

  // Получить все тарифы доставки
  app.get("/api/delivery-costs", requireAuth, async (req: Request, res: Response) => {
    try {
      const costs = await db.select().from(deliveryCost);
      res.json(costs);
    } catch (error) {
      console.error("Error fetching delivery costs:", error);
      res.status(500).json({ message: "Ошибка получения тарифов доставки" });
    }
  });

  // Создать тариф доставки
  app.post("/api/delivery-costs", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertDeliveryCostSchema.parse(req.body);

      const [created] = await db.insert(deliveryCost).values({
        carrierId: data.carrierId,
        fromEntityType: data.fromEntityType,
        fromEntityId: data.fromEntityId,
        fromLocation: data.fromLocation,
        toEntityType: data.toEntityType,
        toEntityId: data.toEntityId,
        toLocation: data.toLocation,
        costPerKg: data.costPerKg,
        distance: data.distance || null,
        createdById: req.session.userId,
      }).returning();

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating delivery cost:", error);
      res.status(500).json({ message: "Ошибка создания тарифа доставки" });
    }
  });

  // Обновить тариф доставки
  app.patch("/api/delivery-costs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const data = insertDeliveryCostSchema.partial().parse(req.body);

      const [updated] = await db.update(deliveryCost)
        .set({
          ...data,
          updatedAt: new Date(),
          updatedById: req.session.userId,
        })
        .where(eq(deliveryCost.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Тариф доставки не найден" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error updating delivery cost:", error);
      res.status(500).json({ message: "Ошибка обновления тарифа доставки" });
    }
  });

  // Удалить тариф доставки
  app.delete("/api/delivery-costs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await db.delete(deliveryCost).where(eq(deliveryCost.id, id));
      res.json({ message: "Тариф доставки удален" });
    } catch (error) {
      console.error("Error deleting delivery cost:", error);
      res.status(500).json({ message: "Ошибка удаления тарифа доставки" });
    }
  });
}
