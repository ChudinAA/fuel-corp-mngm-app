import { db } from "../../../db";
import { auditLog, InsertAuditLog, AuditOperation, EntityType, AUDIT_OPERATIONS } from "../entities/audit";
import { eq, and, desc, sql } from "drizzle-orm";
import { getChangedFields } from "../utils/audit-utils";
import { storage } from "../../../storage/index";

export interface AuditContext {
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditOptions {
  entityType: EntityType;
  entityId: string;
  operation: AuditOperation;
  oldData?: any;
  newData?: any;
  context: AuditContext;
}

export class AuditService {
  /**
   * Resolve human-readable names for FK fields in the data objects.
   * Returns an entityMeta object keyed by UUID, e.g.:
   *   { "3fa85f64-...": "ООО Газпром", "7c9b1a2d-...": "Нафта" }
   * Storing by UUID ensures both old and new values of a changed FK are resolved.
   */
  private static async resolveFkNames(
    oldData: any,
    newData: any
  ): Promise<Record<string, string>> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = (v: any) => typeof v === "string" && UUID_RE.test(v);

    // FK field → resolver function
    const resolvers: Record<string, (id: string) => Promise<string | null>> = {
      buyerId: async (id) => {
        try { const e = await storage.customers.getCustomer(id); return e?.name || null; } catch { return null; }
      },
      supplierId: async (id) => {
        try { const e = await storage.suppliers.getSupplier(id); return e?.name || null; } catch { return null; }
      },
      carrierId: async (id) => {
        try { const e = await storage.logistics.getLogisticsCarrier(id); return e?.name || null; } catch { return null; }
      },
      warehouseId: async (id) => {
        try { const e = await storage.warehouses.getWarehouse(id); return e?.name || null; } catch { return null; }
      },
      fromWarehouseId: async (id) => {
        try { const e = await storage.warehouses.getWarehouse(id); return e?.name || null; } catch { return null; }
      },
      toWarehouseId: async (id) => {
        try { const e = await storage.warehouses.getWarehouse(id); return e?.name || null; } catch { return null; }
      },
      driverId: async (id) => {
        try {
          const e = await storage.logistics.getLogisticsDriver(id);
          return e ? `${e.lastName} ${e.firstName}`.trim() : null;
        } catch { return null; }
      },
      vehicleId: async (id) => {
        try { const e = await storage.logistics.getLogisticsVehicle(id); return e?.licensePlate || null; } catch { return null; }
      },
      trailerId: async (id) => {
        try { const e = await storage.logistics.getLogisticsTrailer(id); return e?.licensePlate || null; } catch { return null; }
      },
    };

    // Collect unique (field, uuid) pairs from both old and new data
    // Map by UUID to avoid resolving the same entity twice
    const toResolve = new Map<string, { field: string; id: string }>();
    for (const data of [oldData, newData]) {
      if (!data || typeof data !== "object") continue;
      for (const [key, value] of Object.entries(data)) {
        if (resolvers[key] && isUUID(value)) {
          const uuid = value as string;
          if (!toResolve.has(uuid)) {
            toResolve.set(uuid, { field: key, id: uuid });
          }
        }
      }
    }

    // Resolve all names in parallel; store keyed by UUID so client can look up either old or new
    const meta: Record<string, string> = {};
    await Promise.all(
      Array.from(toResolve.values()).map(async ({ field, id }) => {
        const resolver = resolvers[field];
        const name = await resolver(id);
        if (name) {
          meta[id] = name; // keyed by UUID
        }
      })
    );

    return meta;
  }

  /**
   * Log an audit entry
   */
  static async log(options: AuditOptions): Promise<void> {
    const {
      entityType,
      entityId,
      operation,
      oldData,
      newData,
      context,
    } = options;

    try {
      // Normalize data to ensure consistent formatting
      const normalizedOldData = oldData ? this.normalizeDataForAudit(oldData) : null;
      const normalizedNewData = newData ? this.normalizeDataForAudit(newData) : null;

      // Calculate changed fields for UPDATE operations
      let changedFields: string[] | null = null;
      if (operation === AUDIT_OPERATIONS.UPDATE && normalizedOldData && normalizedNewData) {
        changedFields = getChangedFields(normalizedOldData, normalizedNewData);
      }

      // Resolve human-readable names for FK fields (buyerId, supplierId, etc.)
      const entityMeta = await this.resolveFkNames(oldData, newData);

      await db.insert(auditLog).values({
        entityType,
        entityId,
        operation,
        oldData: oldData || null,
        newData: newData || null,
        changedFields: changedFields && changedFields.length > 0 ? changedFields : null,
        entityMeta: Object.keys(entityMeta).length > 0 ? entityMeta : null,
        userId: context.userId || null,
        userName: context.userName || null,
        userEmail: context.userEmail || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
      });

      // If this is a DELETE operation, mark all previous audit entries for this entity
      if (operation === AUDIT_OPERATIONS.DELETE) {
        await db.update(auditLog)
          .set({ entityDeleted: new Date().toISOString() })
          .where(
            and(
              eq(auditLog.entityType, entityType),
              eq(auditLog.entityId, entityId),
              sql`${auditLog.operation} IN ('CREATE', 'UPDATE')`
            )
          );
      }

      // If this is a RESTORE operation, clear entityDeleted from previous entries
      if (operation === AUDIT_OPERATIONS.RESTORE) {
        await db.update(auditLog)
          .set({ entityDeleted: null })
          .where(
            and(
              eq(auditLog.entityType, entityType),
              eq(auditLog.entityId, entityId),
              sql`${auditLog.operation} IN ('CREATE', 'UPDATE')`
            )
          );
      }
    } catch (error) {
      console.error('Error logging audit entry:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Normalize data for consistent audit logging
   * Converts numeric strings to consistent format and handles objects/arrays
   */
  private static normalizeDataForAudit(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Handle arrays - skip them in audit (like baseIds, warehouseBases)
    if (Array.isArray(data)) {
      return undefined;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip arrays and nested objects (relations)
      if (Array.isArray(value) || (value && typeof value === 'object' && !(value as any).toISOString)) {
        continue;
      }

      // Keep null/undefined as is
      if (value === null || value === undefined) {
        normalized[key] = value;
        continue;
      }

      // Normalize numeric strings to remove trailing zeros (but keep zeros)
      if (typeof value === 'string' && /^\d+\.?\d*$/.test(value)) {
        const num = parseFloat(value);
        normalized[key] = num.toString();
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  /**
   * Get audit history for a specific entity
   */
  static async getEntityHistory(entityType: EntityType, entityId: string, limit = 50, offset = 0) {
    const where = and(
      eq(auditLog.entityType, entityType),
      eq(auditLog.entityId, entityId)
    );

    const [data, totalResult] = await Promise.all([
      db.query.auditLog.findMany({
        where,
        orderBy: [desc(auditLog.createdAt)],
        limit,
        offset,
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
            }
          }
        }
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where)
    ]);

    return {
      data,
      total: totalResult[0]?.count || 0
    };
  }

  /**
   * Get recent audit entries for an entity type
   */
  static async getRecentAuditEntries(entityType: EntityType, limit = 100, offset = 0) {
    const where = eq(auditLog.entityType, entityType);

    const [data, totalResult] = await Promise.all([
      db.query.auditLog.findMany({
        where,
        orderBy: [desc(auditLog.createdAt)],
        limit,
        offset,
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
            }
          }
        }
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where)
    ]);

    return {
      data,
      total: totalResult[0]?.count || 0
    };
  }

  /**
   * Get audit entries by user
   */
  static async getUserAuditHistory(userId: string, limit = 100, offset = 0) {
    const where = eq(auditLog.userId, userId);

    const [data, totalResult] = await Promise.all([
      db.query.auditLog.findMany({
        where,
        orderBy: [desc(auditLog.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where)
    ]);

    return {
      data,
      total: totalResult[0]?.count || 0
    };
  }



  /**
   * Get audit statistics for an entity type
   */
  static async getAuditStats(entityType: EntityType, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await db
      .select({
        operation: auditLog.operation,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, entityType),
          sql`${auditLog.createdAt} >= ${since.toISOString()}`
        )
      )
      .groupBy(auditLog.operation);

    return stats;
  }
}
