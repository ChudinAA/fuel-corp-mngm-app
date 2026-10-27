import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { auditLog, AUDIT_OPERATIONS, ENTITY_TYPES } from "../server/modules/audit/entities/audit";
import { AuditService } from "../server/modules/audit/services/audit-service";
import { RollbackService } from "../server/modules/audit/services/rollback-service";
import { bases } from "../server/modules/bases/entities/bases";

after(async () => {
  await pool.end();
});

test("failed RESTORE audit leaves a deleted non-refueling record and audit history unchanged", async () => {
  const [base] = await db
    .insert(bases)
    .values({
      name: `rollback-atomicity-${crypto.randomUUID()}`,
      baseType: "wholesale",
      deletedAt: new Date().toISOString(),
    })
    .returning();
  let deleteAudit: typeof auditLog.$inferSelect | undefined;
  const originalLog = AuditService.log;
  try {
    [deleteAudit] = await db
      .insert(auditLog)
      .values({
        entityType: ENTITY_TYPES.BASE,
        entityId: base.id,
        operation: AUDIT_OPERATIONS.DELETE,
        oldData: { id: base.id, name: base.name, baseType: base.baseType },
      })
      .returning();

    (AuditService as any).log = async () => {
      throw new Error("Simulated RESTORE audit write failure");
    };

    const result = await RollbackService.rollback({
      auditLogId: deleteAudit!.id,
      context: {},
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Simulated RESTORE audit write failure/);

    const [baseAfter] = await db.select().from(bases).where(eq(bases.id, base.id));
    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, ENTITY_TYPES.BASE), eq(auditLog.entityId, base.id)));

    assert.equal(baseAfter.deletedAt, base.deletedAt);
    assert.deepEqual(auditAfter, [deleteAudit]);
  } finally {
    AuditService.log = originalLog;
    await db.delete(auditLog).where(eq(auditLog.entityId, base.id));
    await db.delete(bases).where(eq(bases.id, base.id));
  }
});

test("successful non-refueling restore commits the record and both audit updates together", async () => {
  const [base] = await db
    .insert(bases)
    .values({
      name: `rollback-atomicity-${crypto.randomUUID()}`,
      baseType: "wholesale",
      deletedAt: new Date().toISOString(),
    })
    .returning();
  try {
    const [deleteAudit] = await db
      .insert(auditLog)
      .values({
        entityType: ENTITY_TYPES.BASE,
        entityId: base.id,
        operation: AUDIT_OPERATIONS.DELETE,
        oldData: { id: base.id, name: base.name, baseType: base.baseType },
      })
      .returning();

    const result = await RollbackService.rollback({
      auditLogId: deleteAudit.id,
      context: {},
    });

    assert.equal(result.success, true, result.message);
    const [baseAfter] = await db.select().from(bases).where(eq(bases.id, base.id));
    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, ENTITY_TYPES.BASE), eq(auditLog.entityId, base.id)));

    assert.equal(baseAfter.deletedAt, null);
    assert.ok(auditAfter.find((entry) => entry.id === deleteAudit.id)?.rolledBackAt);
    assert.ok(auditAfter.find((entry) => entry.operation === AUDIT_OPERATIONS.RESTORE));
  } finally {
    await db.delete(auditLog).where(eq(auditLog.entityId, base.id));
    await db.delete(bases).where(eq(bases.id, base.id));
  }
});

test("failed CREATE rollback audit leaves the entity and rollback marker unchanged", async () => {
  const [base] = await db
    .insert(bases)
    .values({
      name: `rollback-create-audit-failure-${crypto.randomUUID()}`,
      baseType: "wholesale",
    })
    .returning();
  const originalLog = AuditService.log;
  let createAudit: typeof auditLog.$inferSelect | undefined;
  try {
    [createAudit] = await db
      .insert(auditLog)
      .values({
        entityType: ENTITY_TYPES.BASE,
        entityId: base.id,
        operation: AUDIT_OPERATIONS.CREATE,
        newData: base,
      })
      .returning();

    (AuditService as any).log = (
      options: any,
      _executor: any,
      throwOnError: boolean,
    ) =>
      (originalLog as any).call(
        AuditService,
        options,
        {
          insert: () => ({
            values: async () => {
              throw new Error("Simulated CREATE rollback audit failure");
            },
          }),
        },
        throwOnError,
      );

    const result = await RollbackService.rollback({
      auditLogId: createAudit!.id,
      context: {},
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Simulated CREATE rollback audit failure/);

    const [baseAfter] = await db.select().from(bases).where(eq(bases.id, base.id));
    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, ENTITY_TYPES.BASE), eq(auditLog.entityId, base.id)));

    assert.equal(baseAfter.deletedAt, null);
    assert.deepEqual(auditAfter, [createAudit]);
  } finally {
    AuditService.log = originalLog;
    await db.delete(auditLog).where(eq(auditLog.entityId, base.id));
    await db.delete(bases).where(eq(bases.id, base.id));
  }
});

test("successful CREATE rollback writes its DELETE audit entry and rollback marker", async () => {
  const [base] = await db
    .insert(bases)
    .values({
      name: `rollback-create-audit-success-${crypto.randomUUID()}`,
      baseType: "wholesale",
    })
    .returning();
  try {
    const [createAudit] = await db
      .insert(auditLog)
      .values({
        entityType: ENTITY_TYPES.BASE,
        entityId: base.id,
        operation: AUDIT_OPERATIONS.CREATE,
        newData: base,
      })
      .returning();

    const result = await RollbackService.rollback({
      auditLogId: createAudit.id,
      context: {},
    });

    assert.equal(result.success, true, result.message);
    const [baseAfter] = await db.select().from(bases).where(eq(bases.id, base.id));
    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, ENTITY_TYPES.BASE), eq(auditLog.entityId, base.id)));

    assert.ok(baseAfter.deletedAt);
    assert.ok(auditAfter.find((entry) => entry.id === createAudit.id)?.rolledBackAt);
    assert.ok(
      auditAfter.some(
        (entry) => entry.operation === AUDIT_OPERATIONS.DELETE && entry.oldData?.id === base.id,
      ),
    );
  } finally {
    await db.delete(auditLog).where(eq(auditLog.entityId, base.id));
    await db.delete(bases).where(eq(bases.id, base.id));
  }
});

test("failed UPDATE rollback audit leaves the entity and rollback marker unchanged", async () => {
  const [base] = await db
    .insert(bases)
    .values({
      name: `rollback-update-audit-failure-${crypto.randomUUID()}`,
      baseType: "wholesale",
    })
    .returning();
  const originalLog = AuditService.log;
  let updateAudit: typeof auditLog.$inferSelect | undefined;
  try {
    const changedName = `${base.name}-changed`;
    await db.update(bases).set({ name: changedName }).where(eq(bases.id, base.id));
    [updateAudit] = await db
      .insert(auditLog)
      .values({
        entityType: ENTITY_TYPES.BASE,
        entityId: base.id,
        operation: AUDIT_OPERATIONS.UPDATE,
        oldData: base,
        newData: { ...base, name: changedName },
      })
      .returning();

    (AuditService as any).log = (
      options: any,
      _executor: any,
      throwOnError: boolean,
    ) =>
      (originalLog as any).call(
        AuditService,
        options,
        {
          insert: () => ({
            values: async () => {
              throw new Error("Simulated UPDATE rollback audit failure");
            },
          }),
        },
        throwOnError,
      );

    const result = await RollbackService.rollback({
      auditLogId: updateAudit!.id,
      context: {},
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Simulated UPDATE rollback audit failure/);

    const [baseAfter] = await db.select().from(bases).where(eq(bases.id, base.id));
    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, ENTITY_TYPES.BASE), eq(auditLog.entityId, base.id)));

    assert.equal(baseAfter.name, changedName);
    assert.deepEqual(auditAfter, [updateAudit]);
  } finally {
    AuditService.log = originalLog;
    await db.delete(auditLog).where(eq(auditLog.entityId, base.id));
    await db.delete(bases).where(eq(bases.id, base.id));
  }
});

test("successful UPDATE rollback writes its UPDATE audit entry and rollback marker", async () => {
  const [base] = await db
    .insert(bases)
    .values({
      name: `rollback-update-audit-success-${crypto.randomUUID()}`,
      baseType: "wholesale",
    })
    .returning();
  try {
    const changedName = `${base.name}-changed`;
    await db.update(bases).set({ name: changedName }).where(eq(bases.id, base.id));
    const [updateAudit] = await db
      .insert(auditLog)
      .values({
        entityType: ENTITY_TYPES.BASE,
        entityId: base.id,
        operation: AUDIT_OPERATIONS.UPDATE,
        oldData: base,
        newData: { ...base, name: changedName },
      })
      .returning();

    const result = await RollbackService.rollback({
      auditLogId: updateAudit.id,
      context: {},
    });

    assert.equal(result.success, true, result.message);
    const [baseAfter] = await db.select().from(bases).where(eq(bases.id, base.id));
    const auditAfter = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, ENTITY_TYPES.BASE), eq(auditLog.entityId, base.id)));
    const rollbackAudit = auditAfter.find(
      (entry) => entry.id !== updateAudit.id && entry.operation === AUDIT_OPERATIONS.UPDATE,
    );

    assert.equal(baseAfter.name, base.name);
    assert.ok(auditAfter.find((entry) => entry.id === updateAudit.id)?.rolledBackAt);
    assert.equal(rollbackAudit?.oldData?.name, changedName);
    assert.equal(rollbackAudit?.newData?.name, base.name);
  } finally {
    await db.delete(auditLog).where(eq(auditLog.entityId, base.id));
    await db.delete(bases).where(eq(bases.id, base.id));
  }
});
