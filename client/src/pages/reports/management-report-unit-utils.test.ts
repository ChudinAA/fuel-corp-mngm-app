import assert from "node:assert/strict";
import test from "node:test";
import {
  formatManagementReportMassTonnes,
  getManagementReportMassTonnes,
} from "./management-report-unit-utils";

test("new management reports use explicit tonne values", () => {
  assert.equal(getManagementReportMassTonnes("2.34567", "2345.67"), 2.34567);
  assert.equal(formatManagementReportMassTonnes("2.34567", undefined), "2,34567");
});

test("malformed explicit tonne values fail rather than showing a false zero", () => {
  assert.throws(() => getManagementReportMassTonnes("not-a-number", "1000"));
});
