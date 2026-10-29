import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import test from "node:test";
import { ExcelService } from "./services/excel-service";
import { legacyDealMassToTonnes } from "@shared/units";

const excelService = new ExcelService();

test("legacy deal mass uses saved kilograms and never reconstructs from liters", () => {
  assert.equal(legacyDealMassToTonnes("1234.5", "1000", "0.8"), 1.2345);
  assert.equal(legacyDealMassToTonnes("1234.5", null, null), 1.2345);
  assert.equal(legacyDealMassToTonnes("1234.5", "1000", "0"), 1.2345);
  assert.equal(legacyDealMassToTonnes(null, "1000", "0.8"), null);
});

test("OPT exports legacy mass in tonnes and derives the per-tonne rate from the saved amount", async () => {
  const sheet = await exportSheet(
    "opt",
    ["quantityKg", "salePrice", "saleAmount"],
    [{
      quantityKg: "1234.5",
      quantityLiters: "1500",
      density: "0.8230",
      salePrice: "75",
      saleAmount: "123450",
    }],
  );

  assert.equal(sheet.getCell("A1").value, "Масса (т)");
  assert.equal(sheet.getCell("A2").value, 1.2345);
  assert.equal(sheet.getCell("B1").value, "Цена продажи (₽/т)");
  assert.equal(sheet.getCell("B2").value, 100000);
  assert.equal(sheet.getCell("C2").value, 123450);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
});

test("foreign refueling exports saved deal mass and preserves the USD amount", async () => {
  const sheet = await exportSheet(
    "refueling-abroad",
    ["quantityKg", "purchasePriceUsd", "purchaseAmountUsd"],
    [{
      quantityKg: "750",
      quantityLiters: "900",
      density: "0.8333",
      purchasePriceUsd: "2.5",
      purchaseAmountUsd: "1875",
    }],
  );

  assert.equal(sheet.getCell("A1").value, "Масса (т)");
  assert.equal(sheet.getCell("A2").value, 0.75);
  assert.equal(sheet.getCell("B1").value, "Цена закупки (USD/т)");
  assert.equal(sheet.getCell("B2").value, 2500);
  assert.equal(sheet.getCell("C2").value, 1875);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
});

async function exportSheet(
  moduleName: string,
  selectedColumns: string[],
  rows: Record<string, unknown>[],
) {
  const buffer = await excelService.generateExcel(rows, {
    moduleName,
    selectedColumns,
    userPermissions: [],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

test("transportation exports use saved tonne mass and rate and preserve amounts", async () => {
  const sheet = await exportSheet(
    "transportation",
    ["quantityTonnes", "salePricePerTonne", "saleAmount"],
    [{
      quantityTonnes: "10.00000",
      salePricePerTonne: "62500.123456",
      saleAmount: "500000",
    }],
  );

  assert.equal(sheet.getCell("A1").value, "Масса (т)");
  assert.equal(sheet.getCell("A2").value, 10);
  assert.equal(sheet.getCell("B2").value, 62500.123456);
  assert.equal(sheet.getCell("C2").value, 500000);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
  assert.equal(sheet.getCell("C2").numFmt, "#,##0.00");
});

test("transportation exports do not rebuild missing historical mass from liters", async () => {
  const sheet = await exportSheet(
    "transportation",
    ["quantityTonnes", "salePricePerTonne", "saleAmount"],
    [{
      quantityTonnes: null,
      quantityKg: null,
      quantityLiters: "1000",
      density: "0.8000",
      salePricePerTonne: null,
      salePrice: null,
      saleAmount: "500000",
    }],
  );

  assert.equal(sheet.getCell("A2").value, "");
  assert.equal(sheet.getCell("B2").value, "");
  assert.equal(sheet.getCell("C2").value, 500000);
});

test("warehouse export converts legacy balances and average rates", async () => {
  const sheet = await exportSheet(
    "warehouses",
    ["currentBalance", "averageCost", "pvkjBalance", "pvkjAverageCost"],
    [{
      currentBalance: "1234.567",
      averageCost: "12.345678",
      pvkjBalance: "2500",
      pvkjAverageCost: "3.25",
    }],
  );

  assert.equal(sheet.getCell("A2").value, 1.234567);
  assert.equal(sheet.getCell("B2").value, 12345.678);
  assert.equal(sheet.getCell("C2").value, 2.5);
  assert.equal(sheet.getCell("D2").value, 3250);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
});

test("per-kilogram tariffs export as two-decimal per-tonne prices", async () => {
  const sheet = await exportSheet(
    "delivery-cost",
    ["costPerKg"],
    [{ costPerKg: "0.123456" }],
  );

  assert.equal(sheet.getCell("A1").value, "Тариф (₽/т)");
  assert.equal(sheet.getCell("A2").value, 123.456);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00");
});
