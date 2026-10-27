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
