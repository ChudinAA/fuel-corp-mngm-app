import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import test from "node:test";
import { ExcelService } from "./services/excel-service";

const excelService = new ExcelService();

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

test("OPT exports saved tonne mass and per-tonne rate directly", async () => {
  const sheet = await exportSheet(
    "opt",
    ["quantityTonnes", "salePricePerTonne", "saleAmount"],
    [{
      quantityTonnes: "1.23450",
      salePricePerTonne: "100000",
      saleAmount: "123450",
    }],
  );

  assert.equal(sheet.getCell("A2").value, 1.2345);
  assert.equal(sheet.getCell("B2").value, 100000);
  assert.equal(sheet.getCell("C2").value, 123450);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
});

test("foreign refueling exports tonne rates and saved amounts directly", async () => {
  const sheet = await exportSheet(
    "refueling-abroad",
    ["quantityTonnes", "purchasePriceUsdPerTonne", "purchaseAmountUsd"],
    [{
      quantityTonnes: "0.75000",
      purchasePriceUsdPerTonne: "2500",
      purchaseAmountUsd: "1875",
    }],
  );

  assert.equal(sheet.getCell("A2").value, 0.75);
  assert.equal(sheet.getCell("B2").value, 2500);
  assert.equal(sheet.getCell("C2").value, 1875);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
});

test("transportation exports saved tonne mass and rate and preserves amounts", async () => {
  const sheet = await exportSheet(
    "transportation",
    ["quantityTonnes", "salePricePerTonne", "saleAmount"],
    [{
      quantityTonnes: "10.00000",
      salePricePerTonne: "62500.123456",
      saleAmount: "500000",
    }],
  );

  assert.equal(sheet.getCell("A2").value, 10);
  assert.equal(sheet.getCell("B2").value, 62500.123456);
  assert.equal(sheet.getCell("C2").value, 500000);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
  assert.equal(sheet.getCell("C2").numFmt, "#,##0.00");
});

test("transportation exports do not rebuild missing mass from liters", async () => {
  const sheet = await exportSheet(
    "transportation",
    ["quantityTonnes", "salePricePerTonne", "saleAmount"],
    [{
      quantityTonnes: null,
      quantityLiters: "1000",
      density: "0.8000",
      salePricePerTonne: null,
      saleAmount: "500000",
    }],
  );

  assert.equal(sheet.getCell("A2").value, "");
  assert.equal(sheet.getCell("B2").value, "");
  assert.equal(sheet.getCell("C2").value, 500000);
});

test("warehouse exports use stored tonne balances and rates directly", async () => {
  const sheet = await exportSheet(
    "warehouses",
    [
      "currentBalanceTonnes",
      "averageCostPerTonne",
      "pvkjBalanceTonnes",
      "pvkjAverageCostPerTonne",
    ],
    [{
      currentBalanceTonnes: "1.23457",
      averageCostPerTonne: "12345.678",
      pvkjBalanceTonnes: "2.50000",
      pvkjAverageCostPerTonne: "3250",
    }],
  );

  assert.equal(sheet.getCell("A2").value, 1.23457);
  assert.equal(sheet.getCell("B2").value, 12345.678);
  assert.equal(sheet.getCell("C2").value, 2.5);
  assert.equal(sheet.getCell("D2").value, 3250);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00000");
  assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
});

test("delivery tariffs export as stored per-tonne prices", async () => {
  const sheet = await exportSheet(
    "delivery-cost",
    ["costPerTonne"],
    [{ costPerTonne: "123.456" }],
  );

  assert.equal(sheet.getCell("A2").value, 123.456);
  assert.equal(sheet.getCell("A2").numFmt, "#,##0.00");
});
