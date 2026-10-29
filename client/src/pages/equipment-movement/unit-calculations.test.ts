import assert from "node:assert/strict";
import test from "node:test";
import { equipmentMovementFormSchema } from "./schemas";
import {
  calculateEquipmentMovementTonnes,
  calculateLikAvailableBalanceTonnes,
} from "./unit-calculations";

test("equipment movement mass converts from tonnes and deal liters", () => {
  assert.equal(
    calculateEquipmentMovementTonnes("tonnes", "0.60000", "", ""),
    0.6,
  );
  assert.equal(
    calculateEquipmentMovementTonnes("liters", "", "750", "0.8"),
    0.6,
  );
  assert.equal(
    calculateEquipmentMovementTonnes("liters", "", "750", "0"),
    null,
  );
});

test("LIK balance reads tonne snapshots and restores edited tonnes", () => {
  assert.equal(
    calculateLikAvailableBalanceTonnes(
      { balanceTonnes: "1.25" },
      "2",
      true,
      0.5,
    ),
    1.75,
  );
  assert.equal(
    calculateLikAvailableBalanceTonnes(
      null,
      "1.25000",
      false,
      0.5,
    ),
    1.25,
  );
});

test("equipment movement form validates tonnes and density-based liters", () => {
  const common = {
    movementDate: new Date(),
    movementType: "transfer",
    productType: "kerosene",
  };
  assert.equal(
    equipmentMovementFormSchema.safeParse({
      ...common,
      inputMode: "tonnes",
      quantityTonnes: "0.00001",
    }).success,
    true,
  );
  assert.equal(
    equipmentMovementFormSchema.safeParse({
      ...common,
      inputMode: "tonnes",
      quantityTonnes: "0",
    }).success,
    false,
  );
  assert.equal(
    equipmentMovementFormSchema.safeParse({
      ...common,
      inputMode: "liters",
      quantityLiters: "750",
      density: "0.8",
    }).success,
    true,
  );
  assert.equal(
    equipmentMovementFormSchema.safeParse({
      ...common,
      inputMode: "liters",
      quantityLiters: "750",
      density: "0",
    }).success,
    false,
  );
});
