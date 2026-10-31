import assert from "node:assert/strict";
import test from "node:test";
import { formatTonnes, formatTonnesForInput } from "./units";

test("formatTonnes trims trailing zeroes and keeps up to five decimals", () => {
  assert.equal(formatTonnes(6), "6");
  assert.equal(formatTonnes(13.59), "13,59");
  assert.equal(formatTonnes(2.8928000000000003), "2,8928");
  assert.equal(formatTonnes(0), "0");
  assert.equal(formatTonnes(0.00001), "0,00001");
});

test("formatTonnesForInput uses dot decimals without fixed zeroes", () => {
  assert.equal(formatTonnesForInput(6), "6");
  assert.equal(formatTonnesForInput(13.59), "13.59");
  assert.equal(formatTonnesForInput(2.8928000000000003), "2.8928");
  assert.equal(formatTonnesForInput(0), "0");
  assert.equal(formatTonnesForInput(0.00001), "0.00001");
});
