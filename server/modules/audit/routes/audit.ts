
import { Router, type Express } from "express";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { AuditService } from "../services/audit-service";
import { ENTITY_TYPES } from "../entities/audit";
import { z } from "zod";

const router = Router();

/**
 * Get audit history for a specific entity
 * GET /api/audit/:entityType/:entityId
 */
router.get(
  "/audit/:entityType/:entityId",
  requireAuth,
  async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      // Validate entity type
      if (!Object.values(ENTITY_TYPES).includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const history = await AuditService.getEntityHistory(
        entityType as any,
        entityId,
        limit
      );

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching audit history:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * Get recent audit entries for an entity type
 * GET /api/audit/:entityType
 */
router.get(
  "/audit/:entityType",
  requireAuth,
  async (req, res) => {
    try {
      const { entityType } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      // Validate entity type
      if (!Object.values(ENTITY_TYPES).includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const entries = await AuditService.getRecentAuditEntries(
        entityType as any,
        limit
      );

      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching recent audit entries:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * Get audit statistics for an entity type
 * GET /api/audit/stats/:entityType
 */
router.get(
  "/audit/stats/:entityType",
  requireAuth,
  requirePermission("audit", "view_stats"),
  async (req, res) => {
    try {
      const { entityType } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      // Validate entity type
      if (!Object.values(ENTITY_TYPES).includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const stats = await AuditService.getAuditStats(
        entityType as any,
        days
      );

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching audit stats:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * Get audit history for current user
 * GET /api/audit/user/me
 */
router.get(
  "/audit/user/me",
  requireAuth,
  async (req, res) => {
    try {
      const userId = String(req.session.userId);
      const limit = parseInt(req.query.limit as string) || 100;

      const history = await AuditService.getUserAuditHistory(userId, limit);

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching user audit history:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

export function registerAuditRoutes(app: Express) {
  app.use("/api", router);
}
