import assert from "node:assert/strict";
import test from "node:test";
import { RECALCULATION_STATUS } from "@shared/constants";
import {
  MAX_AUTOMATIC_RECALCULATION_ATTEMPTS,
  toRecalculationIssueView,
} from "./recalculation-issue-view";

const sourceRecord = {
  id: "queue-id",
  recordId: "stock-id",
  recordName: "Склад № 1",
  recordType: "warehouse" as const,
  productType: "kerosene",
  afterDate: "2026-10-29T00:00:00.000Z",
  attempts: 2,
};

test("pending recalculation issues explain that the retry is automatic", () => {
  const issue = toRecalculationIssueView({
    ...sourceRecord,
    status: RECALCULATION_STATUS.PENDING,
  });

  assert.equal(issue.status, RECALCULATION_STATUS.PENDING);
  assert.match(issue.nextAction, /автоматически/i);
  assert.equal(issue.attempts, 2);
  assert.equal(issue.maxAttempts, MAX_AUTOMATIC_RECALCULATION_ATTEMPTS);
});

test("processing recalculation issues tell operators to wait", () => {
  const issue = toRecalculationIssueView({
    ...sourceRecord,
    status: RECALCULATION_STATUS.PROCESSING,
  });

  assert.match(issue.nextAction, /дождитесь/i);
});

test("failed issues require administrator intervention without exposing raw errors", () => {
  const recordWithRawError = {
    ...sourceRecord,
    recordType: "equipment" as const,
    recordName: "Цистерна 1",
    errorMessage: "sensitive database error with credentials",
  };
  const issue = toRecalculationIssueView({
    ...recordWithRawError,
    status: RECALCULATION_STATUS.FAILED,
  });

  assert.equal(issue.recordType, "equipment");
  assert.equal(issue.recordName, "Цистерна 1");
  assert.match(issue.nextAction, /администратору/i);
  assert.equal("errorMessage" in issue, false);
  assert.equal(JSON.stringify(issue).includes("sensitive database error"), false);
});

