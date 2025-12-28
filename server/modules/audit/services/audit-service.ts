import { db } from "../../../db";
import { auditLog, InsertAuditLog, AuditOperation, EntityType, AUDIT_OPERATIONS } from "../entities/audit";
import { eq, and, desc, sql } from "drizzle-orm";
import { getChangedFields } from "../utils/audit-utils";

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
        changedFields = this.calculateChangedFields(normalizedOldData, normalizedNewData);
      }

      // Insert audit log entry
      await db.insert(auditLog).values({
        entityType,
        entityId,
        operation,
        oldData: normalizedOldData,
        newData: normalizedNewData,
        changedFields,
        userId: context.userId,
        userName: context.userName,
        userEmail: context.userEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch (error) {
      console.error('Error logging audit entry:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Normalize data for consistent audit logging
   * Converts numeric strings to consistent format
   */
  private static normalizeDataForAudit(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined
      if (value === null || value === undefined) {
        normalized[key] = value;
        continue;
      }

      // Normalize numeric strings to remove trailing zeros
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
  static async getEntityHistory(entityType: EntityType, entityId: string, limit = 50) {
    return db.query.auditLog.findMany({
      where: and(
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId)
      ),
      orderBy: [desc(auditLog.createdAt)],
      limit,
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
          }
        }
      }
    });
  }

  /**
   * Get recent audit entries for an entity type
   */
  static async getRecentAuditEntries(entityType: EntityType, limit = 100) {
    return db.query.auditLog.findMany({
      where: eq(auditLog.entityType, entityType),
      orderBy: [desc(auditLog.createdAt)],
      limit,
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
          }
        }
      }
    });
  }

  /**
   * Get audit entries by user
   */
  static async getUserAuditHistory(userId: string, limit = 100) {
    return db.query.auditLog.findMany({
      where: eq(auditLog.userId, userId),
      orderBy: [desc(auditLog.createdAt)],
      limit,
    });
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