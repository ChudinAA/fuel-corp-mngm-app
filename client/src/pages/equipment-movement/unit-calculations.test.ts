import assert from "node:assert/strict";
import test from "node:test";
import { equipmentMovementFormSchema } from "./schemas";
import {
  calculateEquipmentMovementTonnes,
  equipmentMovementLegacyKgToTonnes,
  equipmentMovementLegacyPricePerKgToPerTonne,
  equipmentMovementTonnesRateToLegacyKgRate,
  equipmentMovementTonnesToLegacyKg,
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

test("equipment movement adapters preserve legacy mass and price rates", () => {
  assert.equal(equipmentMovementTonnesToLegacyKg(0.6), 600);
  assert.equal(equipmentMovementLegacyKgToTonnes(600), 0.6);
  assert.equal(equipmentMovementLegacyPricePerKgToPerTonne(80), 80_000);
  assert.equal(equipmentMovementTonnesRateToLegacyKgRate(80_000), 80);
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
