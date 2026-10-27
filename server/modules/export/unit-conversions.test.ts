import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import test from "node:test";
import { ExcelService } from "./services/excel-service";
import { legacyDealMassToTonnes } from "@shared/units";

const excelService = new ExcelService();

test("legacy deal mass prefers liters and density, then falls back to kilograms", () => {
  assert.equal(legacyDealMassToTonnes("1234.5", "1000", "0.8"), 0.8);
  assert.equal(legacyDealMassToTonnes("1234.5", null, null), 1.2345);
  assert.equal(legacyDealMassToTonnes("1234.5", "1000", "0"), 1.2345);
  assert.equal(legacyDealMassToTonnes(null, null, null), null);
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

test("deal exports show tonnes and derive per-tonne rates from saved totals", async () => {
  const sheet = await exportSheet(
    "transportation",
    ["quantityKg", "salePrice", "saleAmount"],
    [{
      quantityKg: "10000",
      quantityLiters: "10000",
      density: "0.8000",
      salePrice: "50",
      saleAmount: "500000",
    }],
  );

  assert.equal(sheet.getCell("A1").value, "Масса (т)");
  assert.equal(sheet.getCell("A2").value, 8);
  assert.equal(sheet.getCell("B2").value, 62500);
  assert.equal(sheet.getCell("C2").value, 500000);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
  assert.equal(sheet.getCell("C2").numFmt, "#,##0.00");
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
