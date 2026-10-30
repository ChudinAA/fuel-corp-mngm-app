import assert from "node:assert/strict";
import test from "node:test";
import { RECALCULATION_STATUS } from "@shared/constants";
import { db } from "../../../db";
import { EquipmentRecalculationQueueService } from "../../warehouses-equipment/services/equipment-recalculation-queue-service";
import { MAX_AUTOMATIC_RECALCULATION_ATTEMPTS } from "./recalculation-issue-view";
import { RecalculationQueueService } from "./recalculation-queue-service";

type QueueScenario = {
  queryName: "recalculationQueue" | "equipmentRecalculationQueue";
  queueTable: unknown;
  recordIdField: "warehouseId" | "equipmentId";
  service: typeof RecalculationQueueService | typeof EquipmentRecalculationQueueService;
};

async function assertManualRestartPreservesTarget(
  t: test.TestContext,
  scenario: QueueScenario,
) {
  const dbObject = db as any;
  const query = db.query[scenario.queryName] as any;
  const task: Record<string, any> = {
    id: `${scenario.queryName}-failed-task`,
    [scenario.recordIdField]: `${scenario.queryName}-record`,
    productType: "diesel",
    afterDate: "2026-10-30T00:00:00.000Z",
    status: RECALCULATION_STATUS.FAILED,
    attempts: MAX_AUTOMATIC_RECALCULATION_ATTEMPTS,
    errorMessage: "recalculation failed",
    processingStartedAt: new Date(),
    processedAt: new Date(),
    priority: 7,
  };
  const originalTarget = {
    recordId: task[scenario.recordIdField],
    productType: task.productType,
    afterDate: task.afterDate,
    priority: task.priority,
  };

  Object.defineProperty(dbObject, "update", {
    configurable: true,
    value: (table: unknown) => {
      assert.equal(table, scenario.queueTable);
      return {
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              if (task.status !== RECALCULATION_STATUS.FAILED) return [];
              Object.assign(task, values);
              return [{ id: task.id }];
            },
          }),
        }),
      };
    },
  });

  t.after(() => {
    delete query.findFirst;
    delete dbObject.update;
  });

  assert.equal(await scenario.service.restartFailedTask(task.id), true);
  assert.equal(task.status, RECALCULATION_STATUS.PENDING);
  assert.equal(task.attempts, 0);
  assert.equal(task.errorMessage, null);
  assert.equal(task.processingStartedAt, null);
  assert.equal(task.processedAt, null);
  assert.deepEqual(
    {
      recordId: task[scenario.recordIdField],
      productType: task.productType,
      afterDate: task.afterDate,
      priority: task.priority,
    },
    originalTarget,
  );
  assert.equal(await scenario.service.restartFailedTask(task.id), false);
}

async function assertRetriesThenFails(
  t: test.TestContext,
  scenario: QueueScenario,
) {
  const dbObject = db as any;
  const queueQuery = db.query[scenario.queryName] as any;
  const task: Record<string, any> = {
    id: `${scenario.queryName}-task`,
    [scenario.recordIdField]: `${scenario.queryName}-record`,
    productType: "diesel",
    afterDate: "2026-10-30",
    status: RECALCULATION_STATUS.PENDING,
    attempts: 0,
    priority: 1,
  };

  Object.defineProperty(queueQuery, "findFirst", {
    configurable: true,
    value: async () => task,
  });
  Object.defineProperty(dbObject, "execute", {
    configurable: true,
    value: async (query: { queryChunks: unknown[] }) => {
      assert.match(JSON.stringify(query.queryChunks), /attempts = attempts \+ 1/);

      task.attempts += 1;
      task.status = RECALCULATION_STATUS.PROCESSING;
      task.processingStartedAt = new Date();
      return {
        rows: [
          {
            id: task.id,
            warehouse_id: task.warehouseId,
            equipment_id: task.equipmentId,
            product_type: task.productType,
            after_date: task.afterDate,
            status: task.status,
            priority: task.priority,
            attempts: task.attempts,
            created_by_id: null,
            created_at: null,
            processing_started_at: task.processingStartedAt,
          },
        ],
      };
    },
  });
  Object.defineProperty(dbObject, "update", {
    configurable: true,
    value: (table: unknown) => {
      assert.equal(table, scenario.queueTable);
      return {
        set: (values: Record<string, unknown>) => ({
          where: async () => Object.assign(task, values),
        }),
      };
    },
  });

  t.after(() => {
    delete queueQuery.findFirst;
    delete dbObject.execute;
    delete dbObject.update;
  });

  const errors = Array.from(
    { length: MAX_AUTOMATIC_RECALCULATION_ATTEMPTS },
    (_, index) => `temporary failure ${index + 1}`,
  );

  for (let index = 0; index < errors.length; index += 1) {
    const claimedTask = await scenario.service.claimNextTask();
    assert.ok(claimedTask);
    assert.equal(claimedTask.attempts, index + 1);

    await scenario.service.markAsFailed(task.id, errors[index]);

    assert.equal(task.attempts, index + 1);
    assert.equal(task.errorMessage, errors[index]);
    assert.equal(
      task.status,
      index + 1 === MAX_AUTOMATIC_RECALCULATION_ATTEMPTS
        ? RECALCULATION_STATUS.FAILED
        : RECALCULATION_STATUS.PENDING,
    );
    if (index + 1 < MAX_AUTOMATIC_RECALCULATION_ATTEMPTS) {
      assert.equal(task.processingStartedAt, null);
    }
  }
}

test("warehouse recalculation retries failures until the attempt limit", async (t) => {
  const { recalculationQueue } = await import("@shared/schema");
  await assertRetriesThenFails(t, {
    queryName: "recalculationQueue",
    queueTable: recalculationQueue,
    recordIdField: "warehouseId",
    service: RecalculationQueueService,
  });
});

test("equipment recalculation retries failures until the attempt limit", async (t) => {
  const { equipmentRecalculationQueue } = await import(
    "../../warehouses-equipment/entities/equipment"
  );
  await assertRetriesThenFails(t, {
    queryName: "equipmentRecalculationQueue",
    queueTable: equipmentRecalculationQueue,
    recordIdField: "equipmentId",
    service: EquipmentRecalculationQueueService,
  });
});

test("warehouse manual restart preserves the failed recalculation target", async (t) => {
  const { recalculationQueue } = await import("@shared/schema");
  await assertManualRestartPreservesTarget(t, {
    queryName: "recalculationQueue",
    queueTable: recalculationQueue,
    recordIdField: "warehouseId",
    service: RecalculationQueueService,
  });
});

test("equipment manual restart preserves the failed recalculation target", async (t) => {
  const { equipmentRecalculationQueue } = await import(
    "../../warehouses-equipment/entities/equipment"
  );
  await assertManualRestartPreservesTarget(t, {
    queryName: "equipmentRecalculationQueue",
    queueTable: equipmentRecalculationQueue,
    recordIdField: "equipmentId",
    service: EquipmentRecalculationQueueService,
  });
});
