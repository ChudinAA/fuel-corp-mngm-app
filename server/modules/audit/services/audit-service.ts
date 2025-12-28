
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
    const { entityType, entityId, operation, oldData, newData, context } = options;

    // Calculate changed fields for UPDATE operations
    let changedFields: string[] | undefined;
    if (operation === AUDIT_OPERATIONS.UPDATE && oldData && newData) {
      changedFields = getChangedFields(oldData, newData);
    }

    const auditEntry: InsertAuditLog = {
      entityType,
      entityId,
      operation,
      oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
      newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
      changedFields: changedFields || null,
      userId: context.userId || null,
      userName: context.userName || null,
      userEmail: context.userEmail || null,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    };

    await db.insert(auditLog).values(auditEntry);
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
