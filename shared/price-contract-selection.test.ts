import { test } from "node:test";
import assert from "node:assert/strict";
import { getLatestPriceContract, isPriceContractRequired } from "./price-contract-selection";
import { COUNTERPARTY_TYPE } from "./constants";

test("latest contract date wins over number and database insertion time", () => {
  const rows = [
    { id: "old", contractNumber: "999", contractDate: "2026-01-01", createdAt: "2026-10-01" },
    { id: "new", contractNumber: "1", contractDate: "2026-02-01", createdAt: "2026-02-01" },
  ];
  assert.equal(getLatestPriceContract(rows)?.id, "new");
  assert.equal(rows[0].id, "old");
});

test("highest numbered appendix wins for equal dates using natural number order", () => {
  assert.equal(getLatestPriceContract([
    { id: "parent", contractNumber: "999", contractDate: "2026-01-01" },
    { id: "nine", contractNumber: "9", contractDate: "2026-01-01", parentContractId: "parent" },
    { id: "ten", contractNumber: "10", contractDate: "2026-01-01", parentContractId: "parent" },
  ])?.id, "ten");
});

test("newer appendix wins and equal date/number prefers appendix", () => {
  assert.equal(getLatestPriceContract([
    { id: "parent", contractNumber: "100", contractDate: "2026-01-01" },
    { id: "appendix", contractNumber: "1", contractDate: "2026-02-01", parentContractId: "parent" },
  ])?.id, "appendix");
  assert.equal(getLatestPriceContract([
    { id: "parent", contractNumber: "1", contractDate: "2026-01-01" },
    { id: "appendix", contractNumber: "1", contractDate: "2026-01-01", parentContractId: "parent" },
  ])?.id, "appendix");
});

test("empty directory and creation date fallback", () => {
  assert.equal(getLatestPriceContract([]), undefined);
  assert.equal(getLatestPriceContract([
    { id: "old", contractNumber: "2", createdAt: "2026-01-01" },
    { id: "new", contractNumber: "1", createdAt: "2026-02-01" },
  ])?.id, "new");
});

test("only refueling abroad allows a new price without a contract", () => {
  assert.equal(isPriceContractRequired(COUNTERPARTY_TYPE.REFUELING_ABROAD), false);
  for (const type of [COUNTERPARTY_TYPE.WHOLESALE, COUNTERPARTY_TYPE.REFUELING, COUNTERPARTY_TYPE.TRANSPORTATION]) {
    assert.equal(isPriceContractRequired(type), true);
  }
});
