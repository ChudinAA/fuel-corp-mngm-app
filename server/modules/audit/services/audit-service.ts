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
      // Биржа: продавец и покупатель/поставщик — всегда поставщик
      sellerId: async (id) => {
        try { const e = await storage.suppliers.getSupplier(id); return e?.name || null; } catch { return null; }
      },
      buyerSupplierId: async (id) => {
        try { const e = await storage.suppliers.getSupplier(id); return e?.name || null; } catch { return null; }
      },
      // Цены: контрагент может быть покупателем или поставщиком
      counterpartyId: async (id) => {
        try {
          const customer = await storage.customers.getCustomer(id);
          if (customer?.name) return customer.name;
        } catch {}
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
      deliveryLocationId: async (id) => {
        try { const e = await storage.logistics.getLogisticsDeliveryLocation(id); return e?.name || null; } catch { return null; }
      },
      // Базис склада (для массива baseIds — обрабатывается отдельно ниже)
      baseId: async (id) => {
        try { const e = await storage.bases.getBase(id); return e?.name || null; } catch { return null; }
      },
      driverId: async (id) => {
        try {
          const e = await storage.logistics.getLogisticsDriver(id);
          return e?.fullName || null;
        } catch { return null; }
      },
      vehicleId: async (id) => {
        try { const e = await storage.logistics.getLogisticsVehicle(id); return e?.regNumber || null; } catch { return null; }
      },
      trailerId: async (id) => {
        try { const e = await storage.logistics.getLogisticsTrailer(id); return e?.regNumber || null; } catch { return null; }
      },
      // Перемещения ОП: оборудование
      fromEquipmentId: async (id) => {
        try { const e = await storage.equipment.getEquipment(id); return e?.name || null; } catch { return null; }
      },
      toEquipmentId: async (id) => {
        try { const e = await storage.equipment.getEquipment(id); return e?.name || null; } catch { return null; }
      },
      // Перевозки: базис погрузки (alias на baseId-resolver)
      basisId: async (id) => {
        try { const e = await storage.bases.getBase(id); return e?.name || null; } catch { return null; }
      },
    };

    // Collect unique (field, uuid) pairs from both old and new data
    // Map by UUID to avoid resolving the same entity twice
    const toResolve = new Map<string, { field: string; id: string }>();
    for (const data of [oldData, newData]) {
      if (!data || typeof data !== "object") continue;
      for (const [key, value] of Object.entries(data)) {
        // Scalar FK
        if (resolvers[key] && isUUID(value)) {
          const uuid = value as string;
          if (!toResolve.has(uuid)) {
            toResolve.set(uuid, { field: key, id: uuid });
          }
        }
        // Array FK (baseIds: string[] — массив UUID базисов склада)
        if (key === "baseIds" && Array.isArray(value)) {
          for (const uuid of value) {
            if (isUUID(uuid) && !toResolve.has(uuid)) {
              toResolve.set(uuid, { field: "baseId", id: uuid });
            }
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
        // Храним нормализованные данные для корректного отображения:
        // services → строка, priceValues → строка, baseIds → массив UUID,
        // даты → исходный формат (для правильного отображения в браузере).
        // FK-резолвинг (entityMeta) выполняется из исходных сырых данных выше.
        oldData: normalizedOldData || null,
        newData: normalizedNewData || null,
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

    // Handle top-level arrays — skip (this function processes object data)
    if (Array.isArray(data)) {
      return undefined;
    }

    if (typeof data !== 'object') {
      return data;
    }

    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Arrays — специальная обработка
      if (Array.isArray(value)) {
        // Услуги склада (services): форматируем как читаемую строку
        if (key === 'services') {
          const typeLabels: Record<string, string> = {
            fixed: 'фикс.', per_kg: 'за кг', per_liter: 'за л', per_ton: 'за т',
          };
          const formatted = (value as any[])
            .filter((s) => s?.serviceType && s?.serviceValue != null)
            .map((s) => {
              const name = s.serviceName ? `${s.serviceName}: ` : '';
              const type = typeLabels[s.serviceType] || s.serviceType;
              return `${name}${s.serviceValue} (${type})`;
            }).join('; ');
          if (formatted) normalized[key] = formatted;
        }
        // Цены (priceValues): форматируем как перечень цен.
        // DB хранит как text[] (JSON-строки), тело запроса — как объекты [{price}].
        else if (key === 'priceValues') {
          const parsed = (value as any[]).map((pv) => {
            if (typeof pv === 'string') {
              try { return JSON.parse(pv); } catch { return null; }
            }
            return pv;
          });
          const formatted = parsed
            .map((pv) => pv?.price != null ? String(pv.price) : null)
            .filter(Boolean).join(', ');
          if (formatted) normalized[key] = formatted;
        }
        // Массивы примитивов (baseIds и др.): оставляем как есть для резолвинга UUID на клиенте
        else if (value.every((v: any) => v === null || typeof v === 'string' || typeof v === 'number')) {
          normalized[key] = value;
        }
        // Прочие массивы объектов: пропускаем
        continue;
      }
      // Вложенные объекты (кроме Date): пропускаем
      if (value && typeof value === 'object' && !(value as any).toISOString) {
        continue;
      }

      // Keep null/undefined as is
      if (value === null || value === undefined) {
        normalized[key] = value;
        continue;
      }

      // Normalize numeric values: round to 5 decimal places to eliminate float drift
      if (typeof value === 'number') {
        normalized[key] = parseFloat(value.toFixed(5));
      } else if (typeof value === 'string' && /^-?\d+\.?\d*$/.test(value)) {
        const num = parseFloat(value);
        normalized[key] = isNaN(num) ? value : parseFloat(num.toFixed(5));
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
   * Backfill entityMeta for existing audit entries that have no FK name resolution.
   * Resolves buyerId, supplierId, carrierId, etc. for old records.
   * Run once as an admin migration. Safe to run multiple times.
   */
  static async backfillEntityMeta(): Promise<{ processed: number; updated: number; errors: number }> {
    let processed = 0, updated = 0, errors = 0;
    const batchSize = 100;
    const maxEntries = 10000;

    // Note: we always query with offset=0 because after updating entries they
    // are removed from the WHERE clause (entity_meta IS NULL → not null anymore).
    // Using a fixed offset would skip entries as the result set shifts.
    while (processed < maxEntries) {
      const batch = await db.select()
        .from(auditLog)
        .where(sql`${auditLog.entityMeta} IS NULL AND (${auditLog.oldData} IS NOT NULL OR ${auditLog.newData} IS NOT NULL)`)
        .orderBy(desc(auditLog.createdAt))
        .limit(batchSize);

      if (batch.length === 0) break;

      for (const entry of batch) {
        processed++;
        try {
          const meta = await this.resolveFkNames(entry.oldData, entry.newData);
          // Always update (even with empty meta) to mark as processed and
          // remove from the WHERE clause so next batch doesn't re-read it.
          await db.update(auditLog)
            .set({ entityMeta: Object.keys(meta).length > 0 ? meta : {} })
            .where(eq(auditLog.id, entry.id));
          if (Object.keys(meta).length > 0) updated++;
        } catch {
          errors++;
          // On error, still mark as processed with empty meta to avoid infinite loops
          try {
            await db.update(auditLog)
              .set({ entityMeta: {} })
              .where(eq(auditLog.id, entry.id));
          } catch { /* ignore secondary error */ }
        }
      }
    }

    return { processed, updated, errors };
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
