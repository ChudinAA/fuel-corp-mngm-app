import assert from "node:assert/strict";
import test from "node:test";
import { insertLogisticsDriverSchema } from "../server/modules/logistics/entities/logistics";

test("driver insert schema accepts and preserves license expiry", () => {
  const licenseExpiry = "2030-12-31";
  const parsed = insertLogisticsDriverSchema.parse({
    fullName: "Тестовый Водитель",
    licenseExpiry,
  });

  assert.equal(parsed.licenseExpiry, licenseExpiry);
});

test("driver insert schema accepts an empty license expiry", () => {
  const parsed = insertLogisticsDriverSchema.parse({
    fullName: "Тестовый Водитель",
    licenseExpiry: null,
  });

  assert.equal(parsed.licenseExpiry, null);
});
