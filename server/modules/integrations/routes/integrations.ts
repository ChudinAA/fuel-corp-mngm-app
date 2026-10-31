import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db";
import { requireAdministrator, requireAuth } from "../../../middleware/middleware";
import { users } from "../../users/entities/users";
import { roles } from "../../users/entities/roles";
import {
  allowedCounterpartyTypes,
  counterpartySyncBatchSchema,
  counterpartySyncItemSchema,
  getCounterpartyStatusKind,
  type CounterpartyType,
} from "../counterparty-sync-contract";
import {
  customers,
  integrationApiKeys,
  integrationChangeLogs,
  integrationRequestLogs,
  integrationSettings,
  logisticsCarriers,
  suppliers,
} from "@shared/schema";
import { SSEService } from "../../../services/sse-service";

const allowedEntities = allowedCounterpartyTypes;

const tableByType = {
  supplier: suppliers,
  customer: customers,
  carrier: logisticsCarriers,
} as const;

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch((error) => {
      console.error("[1C integration] Request failed:", error?.message ?? error);
      if (res.headersSent) return next(error);
      res.status(500).json({
        code: "integration_internal_error",
        message: "Не удалось выполнить операцию интеграции",
      });
    });
  };
}

function hashKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

async function authenticateIntegration(req: Request, res: Response, next: NextFunction) {
  const match = /^Bearer\s+(.+)$/i.exec(req.header("authorization") ?? "");
  if (!match) {
    return res.status(401).json({ code: "missing_bearer_token", message: "Требуется API-ключ в заголовке Authorization: Bearer" });
  }

  const suppliedHash = Buffer.from(hashKey(match[1]), "hex");
  try {
    const activeKeys = await db.select().from(integrationApiKeys).where(
      and(eq(integrationApiKeys.integration, "1c"), isNull(integrationApiKeys.revokedAt)),
    );
    const validKey = activeKeys.find((key) => {
      const storedHash = Buffer.from(key.keyHash, "hex");
      return storedHash.length === suppliedHash.length && timingSafeEqual(storedHash, suppliedHash);
    });
    if (!validKey) {
      return res.status(401).json({ code: "invalid_bearer_token", message: "Неверный или отозванный API-ключ" });
    }
    req.integrationApiKeyId = validKey.id;
    next();
  } catch (error) {
    console.error("[1C integration] API key verification failed:", (error as Error)?.message);
    return res.status(503).json({ code: "authentication_unavailable", message: "Временная ошибка проверки API-ключа" });
  }
}

function sanitizeIncoming(item: z.infer<typeof counterpartySyncItemSchema>) {
  return {
    type: item.type,
    id_1c: item.id_1c,
    inn: item.inn ?? null,
    name: item.name,
    full_name: item.full_name ?? null,
    status: item.status ?? null,
  };
}

async function logChange(data: {
  requestId: string;
  type: CounterpartyType;
  entityId?: string | null;
  external1cId: string;
  operation: string;
  outcome: string;
  incomingData: ReturnType<typeof sanitizeIncoming>;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  await db.insert(integrationChangeLogs).values({
    requestId: data.requestId,
    entityType: data.type,
    entityId: data.entityId ?? null,
    external1cId: data.external1cId,
    operation: data.operation,
    outcome: data.outcome,
    incomingData: data.incomingData,
    oldData: data.oldData ?? null,
    newData: data.newData ?? null,
    errorCode: data.errorCode ?? null,
    errorMessage: data.errorMessage ?? null,
  });
}

async function insertChangeLog(executor: any, data: Parameters<typeof logChange>[0]) {
  await executor.insert(integrationChangeLogs).values({
    requestId: data.requestId,
    entityType: data.type,
    entityId: data.entityId ?? null,
    external1cId: data.external1cId,
    operation: data.operation,
    outcome: data.outcome,
    incomingData: data.incomingData,
    oldData: data.oldData ?? null,
    newData: data.newData ?? null,
    errorCode: data.errorCode ?? null,
    errorMessage: data.errorMessage ?? null,
  });
}

async function syncItem(item: z.infer<typeof counterpartySyncItemSchema>, requestId: string) {
  const incoming = sanitizeIncoming(item);
  const statusKind = getCounterpartyStatusKind(item.status);
  if (statusKind === "unknown") {
    await logChange({
      requestId, type: item.type, external1cId: item.id_1c, operation: "sync",
      outcome: "error", incomingData: incoming, errorCode: "unsupported_status",
      errorMessage: "Неподдерживаемое значение status",
    });
    return { id_1c: item.id_1c, type: item.type, outcome: "error", code: "unsupported_status" };
  }

  const table: any = tableByType[item.type];
  try {
    const result = await db.transaction(async (tx) => {
      let [entity] = await tx.select().from(table).where(eq(table.external1cId, item.id_1c)).limit(1);
      let matchedBy = "id_1c";

      if (!entity && item.inn) {
        const matches = await tx.select().from(table).where(eq(table.inn, item.inn)).limit(2);
        if (matches.length > 1) {
          const failure = { outcome: "conflict", code: "ambiguous_inn", entity: null, oldData: null, newData: null, operation: "match" };
          await insertChangeLog(tx, {
            requestId, type: item.type, external1cId: item.id_1c, operation: failure.operation,
            outcome: failure.outcome, incomingData: incoming, errorCode: failure.code,
            errorMessage: "По ИНН найдено несколько записей",
          });
          return failure;
        }
        if (matches.length === 1) {
          entity = matches[0];
          matchedBy = "inn";
          if (entity.external1cId && entity.external1cId !== item.id_1c) {
            const failure = { outcome: "conflict", code: "inn_linked_to_other_id_1c", entity, oldData: null, newData: null, operation: "match" };
            await insertChangeLog(tx, {
              requestId, type: item.type, entityId: entity.id, external1cId: item.id_1c,
              operation: failure.operation, outcome: failure.outcome, incomingData: incoming,
              errorCode: failure.code, errorMessage: "ИНН уже связан с другим Id_1c",
            });
            return failure;
          }
        }
      }

      if (!entity && statusKind === "deleted") {
        const failure = { outcome: "skipped", code: "delete_for_unknown_entity", entity: null, oldData: null, newData: null, operation: "delete" };
        await insertChangeLog(tx, {
          requestId, type: item.type, external1cId: item.id_1c, operation: failure.operation,
          outcome: failure.outcome, incomingData: incoming, errorCode: failure.code,
          errorMessage: "Удаление неизвестной записи пропущено",
        });
        return failure;
      }
      if (!entity && !item.inn) {
        const failure = { outcome: "error", code: "inn_required_for_create", entity: null, oldData: null, newData: null, operation: "create" };
        await insertChangeLog(tx, {
          requestId, type: item.type, external1cId: item.id_1c, operation: failure.operation,
          outcome: failure.outcome, incomingData: incoming, errorCode: failure.code,
          errorMessage: "Для создания записи требуется ИНН",
        });
        return failure;
      }

      const oldData = entity ? {
        id_1c: entity.external1cId ?? null,
        inn: entity.inn ?? null,
        name: entity.name,
        full_name: entity.fullName ?? null,
        status: entity.integrationStatus ?? null,
        deleted_at: entity.deletedAt ?? null,
      } : null;
      const nowDeleted = statusKind === "deleted" || (statusKind === "unchanged" && Boolean(entity?.deletedAt));
      const isActiveFromStatus = statusKind === "active";
      const nextFields: Record<string, unknown> = {
        external1cId: item.id_1c,
        inn: item.inn !== undefined ? item.inn : entity?.inn ?? null,
        name: item.name,
        fullName: item.full_name !== undefined ? item.full_name : entity?.fullName ?? null,
        integrationStatus: item.status ? item.status : entity?.integrationStatus ?? null,
        deletedAt: nowDeleted ? entity?.deletedAt ?? sql`NOW()` : isActiveFromStatus ? null : entity?.deletedAt ?? null,
        deletedById: isActiveFromStatus ? null : entity?.deletedById ?? null,
        updatedAt: sql`NOW()`,
      };

      let operation: string;
      let updatedEntity: any;
      if (!entity) {
        operation = "create";
        const createFields: Record<string, unknown> = {
          ...nextFields,
          integrationPendingReview: true,
        };
        delete createFields.updatedAt;
        delete createFields.deletedAt;
        delete createFields.deletedById;
        if (item.type === "customer") createFields.module = "both";
        const inserted: any = await tx.insert(table).values(createFields).returning();
        updatedEntity = inserted[0] ?? inserted.rows?.[0];
      } else {
        operation = nowDeleted ? "delete" : matchedBy === "inn" ? "link_and_update" : "update";
        [updatedEntity] = await tx.update(table)
          .set(nextFields)
          .where(eq(table.id, entity.id))
          .returning();
      }

      const newData = {
        id_1c: updatedEntity.external1cId ?? null,
        inn: updatedEntity.inn ?? null,
        name: updatedEntity.name,
        full_name: updatedEntity.fullName ?? null,
        status: updatedEntity.integrationStatus ?? null,
        deleted_at: updatedEntity.deletedAt ?? null,
      };
      const outcome = operation === "create" ? "created" : nowDeleted ? "deleted" : "updated";
      await insertChangeLog(tx, {
        requestId, type: item.type, entityId: updatedEntity.id, external1cId: item.id_1c,
        operation, outcome, incomingData: incoming, oldData, newData,
      });
      return {
        outcome,
        code: matchedBy,
        entity: updatedEntity,
        oldData,
        newData,
        operation,
      };
    });

    if (result.entity && ["created", "updated", "deleted"].includes(result.outcome)) {
      const topic = item.type === "supplier" ? "suppliers" : item.type === "customer" ? "customers" : "logistics-directories";
      SSEService.notifyEntityChanged(topic);
    }
    return { id_1c: item.id_1c, type: item.type, outcome: result.outcome, code: result.code, entity_id: result.entity?.id ?? null };
  } catch (error: any) {
    const uniqueConflict = error?.code === "23505";
    await logChange({
      requestId, type: item.type, external1cId: item.id_1c, operation: "sync", outcome: "error",
      incomingData: incoming,
      errorCode: uniqueConflict ? "duplicate_id_1c" : "database_error",
      errorMessage: uniqueConflict ? "Id_1c уже привязан к другой записи" : "Не удалось сохранить изменение",
    }).catch((logError) => console.error("[1C integration] Failed to write change log:", logError?.message));
    return { id_1c: item.id_1c, type: item.type, outcome: "error", code: uniqueConflict ? "duplicate_id_1c" : "database_error" };
  }
}

async function getMasterDataMode() {
  const [activeKey] = await db.select({ id: integrationApiKeys.id })
    .from(integrationApiKeys)
    .where(and(eq(integrationApiKeys.integration, "1c"), isNull(integrationApiKeys.revokedAt)))
    .limit(1);
  return Boolean(activeKey);
}

async function isAdministrator(userId?: string) {
  if (!userId) return false;
  const [user] = await db.select({ roleId: users.roleId })
    .from(users)
    .where(eq(users.id, userId)).limit(1);
  if (!user?.roleId) return false;
  const [role] = await db.select({ name: roles.name }).from(roles).where(eq(roles.id, user.roleId)).limit(1);
  return role?.name === "Админ" || role?.name === "Ген.дир";
}

export function registerIntegrationRoutes(app: Express) {
  app.get("/api/integrations/1c/mode", requireAuth, asyncRoute(async (_req, res) => {
    res.json({ counterpartyMasterDataEnabled: await getMasterDataMode() });
  }));

  const apiPrefix = "/api/integrations/1c/v1";
  app.get(`${apiPrefix}/health`, authenticateIntegration, (_req, res) => {
    res.json({ integration: "1c", api_version: "v1", status: "ok" });
  });

  app.get(`${apiPrefix}/counterparties`, authenticateIntegration, async (req, res) => {
    try {
      const all: Array<Record<string, unknown>> = [];
      for (const type of allowedEntities) {
        const table: any = tableByType[type];
        const rows = await db.select().from(table).where(isNull(table.deletedAt));
        for (const row of rows) {
          all.push({
            type,
            id_1c: row.external1cId ?? null,
            inn: row.inn ?? null,
            name: row.name,
            full_name: row.fullName ?? null,
            status: row.integrationStatus ?? null,
            updated_at: row.updatedAt ?? row.createdAt ?? null,
          });
        }
      }
      req.integrationItemCount = all.length;
      res.json({ items: all, count: all.length });
    } catch (error) {
      console.error("[1C integration] Counterparty export failed:", (error as Error)?.message);
      res.status(500).json({ code: "export_failed", message: "Не удалось выгрузить контрагентов" });
    }
  });

  app.post(`${apiPrefix}/counterparties/sync`, authenticateIntegration, asyncRoute(async (req, res) => {
    req.integrationItemCount = Array.isArray(req.body?.items) ? req.body.items.length : null;
    const parsed = counterpartySyncBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: "invalid_payload",
        message: parsed.error.issues[0]?.message ?? "Некорректный пакет данных",
      });
    }

    req.integrationItemCount = parsed.data.items.length;
    const duplicates = new Set<string>();
    const results = [];
    for (const item of parsed.data.items) {
      const duplicateKey = `${item.type}:${item.id_1c}`;
      if (duplicates.has(duplicateKey)) {
        await logChange({
          requestId: req.integrationRequestId!, type: item.type, external1cId: item.id_1c,
          operation: "sync", outcome: "error", incomingData: sanitizeIncoming(item),
          errorCode: "duplicate_item_in_batch", errorMessage: "Id_1c повторяется в одном пакете",
        });
        results.push({ id_1c: item.id_1c, type: item.type, outcome: "error", code: "duplicate_item_in_batch" });
        continue;
      }
      duplicates.add(duplicateKey);
      results.push(await syncItem(item, req.integrationRequestId!));
    }

    const counts = results.reduce<Record<string, number>>((acc, result) => {
      acc[result.outcome] = (acc[result.outcome] ?? 0) + 1;
      return acc;
    }, {});
    res.json({ request_id: req.integrationRequestId, count: results.length, counts, results });
  }));

  const adminBase = "/api/admin/integrations/1c";
  app.get(`${adminBase}/status`, requireAdministrator, asyncRoute(async (_req, res) => {
    const [activeKey] = await db.select({
      id: integrationApiKeys.id,
      keyPrefix: integrationApiKeys.keyPrefix,
      createdAt: integrationApiKeys.createdAt,
    }).from(integrationApiKeys).where(
      and(eq(integrationApiKeys.integration, "1c"), isNull(integrationApiKeys.revokedAt)),
    ).orderBy(desc(integrationApiKeys.createdAt)).limit(1);
    const [pending] = await db.select({ count: sql<number>`count(*)::int` }).from(integrationChangeLogs)
      .where(and(eq(integrationChangeLogs.outcome, "created"), isNull(integrationChangeLogs.reviewedAt)));
    res.json({
      activeKey: activeKey ?? null,
      pendingReviewCount: pending?.count ?? 0,
    });
  }));

  app.post(`${adminBase}/api-key`, requireAdministrator, asyncRoute(async (req, res) => {
    const key = `1c_live_${randomBytes(36).toString("base64url")}`;
    const keyPrefix = key.slice(0, 16);
    const userId = req.session.userId!;
    const [created] = await db.transaction(async (tx) => {
      await tx.update(integrationApiKeys)
        .set({ revokedAt: sql`NOW()`, revokedById: userId })
        .where(and(eq(integrationApiKeys.integration, "1c"), isNull(integrationApiKeys.revokedAt)));
      const [inserted] = await tx.insert(integrationApiKeys).values({
        integration: "1c",
        label: "1С",
        keyPrefix,
        keyHash: hashKey(key),
        createdById: userId,
      }).returning({ id: integrationApiKeys.id, keyPrefix: integrationApiKeys.keyPrefix, createdAt: integrationApiKeys.createdAt });
      await tx.insert(integrationSettings).values({
        id: 1,
        counterpartyMasterDataEnabled: true,
        updatedById: userId,
      }).onConflictDoUpdate({
        target: integrationSettings.id,
        set: { counterpartyMasterDataEnabled: true, updatedAt: sql`NOW()`, updatedById: userId },
      });
      return [inserted];
    });
    res.status(201).json({ apiKey: key, activeKey: created });
  }));

  app.delete(`${adminBase}/api-key`, requireAdministrator, asyncRoute(async (req, res) => {
    await db.transaction(async (tx) => {
      await tx.update(integrationApiKeys).set({ revokedAt: sql`NOW()`, revokedById: req.session.userId! })
        .where(and(eq(integrationApiKeys.integration, "1c"), isNull(integrationApiKeys.revokedAt)));
      await tx.insert(integrationSettings).values({
        id: 1,
        counterpartyMasterDataEnabled: false,
        updatedById: req.session.userId!,
      }).onConflictDoUpdate({
        target: integrationSettings.id,
        set: { counterpartyMasterDataEnabled: false, updatedAt: sql`NOW()`, updatedById: req.session.userId! },
      });
    });
    res.json({ revoked: true });
  }));

  app.get(`${adminBase}/pending`, requireAdministrator, asyncRoute(async (_req, res) => {
    const rows = await db.select().from(integrationChangeLogs)
      .where(and(eq(integrationChangeLogs.outcome, "created"), isNull(integrationChangeLogs.reviewedAt)))
      .orderBy(desc(integrationChangeLogs.createdAt)).limit(200);
    const pendingItems = await Promise.all(rows.map(async (row) => {
      const table: any = tableByType[row.entityType as CounterpartyType];
      if (!table || !row.entityId) return { ...row, currentEntity: null };
      const [currentEntity] = await db.select().from(table).where(eq(table.id, row.entityId)).limit(1);
      return { ...row, currentEntity: currentEntity ?? null };
    }));
    res.json(pendingItems);
  }));

  app.post(`${adminBase}/changes/:id/review`, requireAdministrator, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const action = req.body?.action;
    if (!Number.isInteger(id) || id < 1 || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Некорректное действие подтверждения" });
    }
    const [change] = await db.select().from(integrationChangeLogs)
      .where(and(eq(integrationChangeLogs.id, id), eq(integrationChangeLogs.outcome, "created"), isNull(integrationChangeLogs.reviewedAt)))
      .limit(1);
    if (!change) return res.status(404).json({ message: "Новая запись не найдена или уже обработана" });
    const table: any = tableByType[change.entityType as CounterpartyType];
    if (!table || !change.entityId) return res.status(400).json({ message: "Неподдерживаемый тип записи" });

    await db.transaction(async (tx) => {
      if (action === "reject") {
        await tx.update(table)
          .set({ deletedAt: sql`NOW()`, deletedById: req.session.userId!, integrationPendingReview: false })
          .where(eq(table.id, change.entityId));
      } else {
        await tx.update(table)
          .set({ integrationPendingReview: false, updatedAt: sql`NOW()` })
          .where(eq(table.id, change.entityId));
      }
      await tx.update(integrationChangeLogs)
        .set({ reviewedAt: sql`NOW()`, reviewedById: req.session.userId! })
        .where(eq(integrationChangeLogs.id, id));
    });
    const topic = change.entityType === "supplier" ? "suppliers" : change.entityType === "customer" ? "customers" : "logistics-directories";
    SSEService.notifyEntityChanged(topic);
    res.json({ reviewed: true, action });
  }));

  app.get(`${adminBase}/logs`, requireAdministrator, asyncRoute(async (req, res) => {
    const rawCursor = req.query.beforeId;
    const cursor = rawCursor === undefined ? null :
      typeof rawCursor === "string" && /^\d+$/.test(rawCursor) ? Number(rawCursor) : NaN;
    if (cursor !== null && (!Number.isSafeInteger(cursor) || cursor < 1)) {
      return res.status(400).json({ message: "Некорректный курсор журнала" });
    }
    const pageSize = 50;
    const conditions = [eq(integrationRequestLogs.integration, "1c")];
    if (cursor !== null) conditions.push(lt(integrationRequestLogs.id, cursor));
    const rows = await db.select().from(integrationRequestLogs)
      .where(and(...conditions))
      .orderBy(desc(integrationRequestLogs.id))
      .limit(pageSize + 1);
    const hasMoreRequests = rows.length > pageSize;
    const requests = rows.slice(0, pageSize);
    const changes = cursor === null
      ? await db.select().from(integrationChangeLogs)
        .where(eq(integrationChangeLogs.integration, "1c"))
        .orderBy(desc(integrationChangeLogs.id))
        .limit(pageSize)
      : [];
    res.json({
      requests,
      changes,
      pageSize,
      hasMoreRequests,
      nextCursor: hasMoreRequests ? requests[requests.length - 1]?.id ?? null : null,
    });
  }));
}

export async function enforceIntegrationMasterData(req: Request, res: Response, next: NextFunction) {
  try {
    if (!await getMasterDataMode()) return next();
    if (await isAdministrator(req.session.userId)) return next();
    return res.status(403).json({ message: "Создание и удаление контрагентов доступно только администратору при включённом обмене с 1С" });
  } catch (error) {
    console.error("[1C integration] Master-data policy check failed:", (error as Error)?.message);
    return res.status(503).json({ message: "Не удалось проверить режим мастер-данных" });
  }
}

export function protectLinkedCounterpartyMasterFields(type: CounterpartyType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const protectedKeys = ["external1cId", "integrationStatus", "integrationPendingReview"];
    if (protectedKeys.some((key) => Object.prototype.hasOwnProperty.call(req.body ?? {}, key))) {
      return res.status(400).json({ message: "Поля синхронизации доступны только через API интеграции" });
    }

    try {
      if (await isAdministrator(req.session.userId)) return next();
      const table: any = tableByType[type];
      const [entity] = await db.select().from(table).where(eq(table.id, req.params.id)).limit(1);
      if (!entity?.external1cId) return next();
      const fieldMap: Record<string, string> = { name: "name", fullName: "fullName", inn: "inn" };
      const changed = Object.entries(fieldMap).some(([inputKey, dbKey]) =>
        Object.prototype.hasOwnProperty.call(req.body ?? {}, inputKey) &&
        (req.body[inputKey] ?? null) !== (entity[dbKey] ?? null),
      );
      if (changed) {
        return res.status(409).json({ message: "ИНН и наименования контрагента синхронизируются из 1С и доступны только для чтения" });
      }
      next();
    } catch (error) {
      console.error("[1C integration] Master-field guard failed:", (error as Error)?.message);
      res.status(503).json({ message: "Не удалось проверить мастер-поля контрагента" });
    }
  };
}
