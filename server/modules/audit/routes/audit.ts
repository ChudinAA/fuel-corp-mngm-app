
import { Router, type Express } from "express";
import { requireAuth, requirePermission } from "../../../middleware/middleware";
import { AuditService } from "../services/audit-service";
import { RollbackService } from "../services/rollback-service";
import { ENTITY_TYPES, auditLog } from "../entities/audit";
import { z } from "zod";
import { getAuditContext } from "../middleware/audit-middleware";
import { storage } from "server/storage";
import { db } from "../../../db";
import { eq } from "drizzle-orm";

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
      const offset = parseInt(req.query.offset as string) || 0;

      // Validate entity type
      if (!Object.values(ENTITY_TYPES).includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const history = await AuditService.getEntityHistory(
        entityType as any,
        entityId,
        limit,
        offset
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
      const offset = parseInt(req.query.offset as string) || 0;

      // Validate entity type
      if (!Object.values(ENTITY_TYPES).includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const result = await AuditService.getRecentAuditEntries(
        entityType as any,
        limit,
        offset
      );

      res.json(result);
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
  requirePermission("audit", "view"),
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

// Map entity types to permission modules for restore checks
const ENTITY_TYPE_TO_MODULE: Record<string, string> = {
  opt: "opt",
  aircraft_refueling: "refueling",
  aircraft_refueling_abroad: "abroad",
  movement: "movement",
  exchange: "exchange",
  warehouses: "warehouses",
  prices: "prices",
  suppliers: "counterparties",
  customers: "counterparties",
  bases: "directories",
  logistics_carriers: "directories",
  logistics_delivery_locations: "directories",
  logistics_vehicles: "directories",
  logistics_trailers: "directories",
  logistics_drivers: "directories",
  delivery_cost: "delivery",
  cashflow_transactions: "finance",
  payment_calendar: "finance",
  price_calculations: "finance",
  users: "users",
  roles: "roles",
  equipment: "equipment",
  equipment_movement: "lik-movement",
  transportation: "transportation",
  railway_stations: "directories",
  railway_tariffs: "directories",
  exchange_deals: "exchange-deals",
  exchange_advance_cards: "exchange-advances",
  storage_cards: "storage-cards",
};

/**
 * Rollback a specific audit entry
 * POST /api/audit/rollback/:auditLogId
 */
router.post(
  "/audit/rollback/:auditLogId",
  requireAuth,
  async (req, res) => {
    try {
      const { auditLogId } = req.params;

      // Get audit context
      const context = getAuditContext(req);
      
      // Enrich with user data and check restore permission
      if (context.userId) {
        const user = await storage.users.getUser(context.userId);
        if (user) {
          context.userName = `${user.firstName} ${user.lastName}`;
          context.userEmail = user.email;
        }

        // Check restore permission based on entity type
        const role = user?.roleId ? await storage.roles.getRole(user.roleId) : null;
        const isAdmin = role?.name === "Админ" || role?.name === "Ген.дир";
        if (!isAdmin) {
          // Look up the audit entry to determine entity type
          const auditEntry = await db.query.auditLog.findFirst({
            where: eq(auditLog.id, auditLogId),
          });
          if (auditEntry) {
            const permModule = ENTITY_TYPE_TO_MODULE[auditEntry.entityType] || auditEntry.entityType;
            const requiredPermission = `${permModule}.restore`;
            const hasRestorePermission = role?.permissions?.includes(requiredPermission);
            if (!hasRestorePermission) {
              return res.status(403).json({ success: false, message: "Недостаточно прав для восстановления записей" });
            }
          }
        }
      }

      // Perform rollback
      const result = await RollbackService.rollback({
        auditLogId,
        context,
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error("Error performing rollback:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

export function registerAuditRoutes(app: Express) {
  app.use("/api", router);
}
