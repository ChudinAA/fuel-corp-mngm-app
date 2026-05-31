
import ExcelJS from "exceljs";
import { exportConfigRegistry } from "../config/modules-config";
import type { ModuleExportConfig, ColumnConfig } from "../entities/export-config";

export interface ExportOptions {
  moduleName: string;
  selectedColumns: string[];
  filters?: Record<string, any>;
  userPermissions: string[];
  includeHeaders?: boolean;
  sheetName?: string;
}

const HEADER_FILL_COLOR = "FF1E3A5F";
const HEADER_FONT_COLOR = "FFFFFFFF";
const ALT_ROW_COLOR = "FFF5F8FC";
const BORDER_COLOR = "FFD0DCE8";

export class ExcelService {
  async generateExcel(data: any[], options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Aviation Fuel Management System";
    workbook.created = new Date();

    const config = exportConfigRegistry[options.moduleName];
    if (!config) {
      throw new Error(`Export configuration not found for module: ${options.moduleName}`);
    }

    const sheetName = (options.sheetName || config.displayName).substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const allowedColumns = this.filterColumnsByPermissions(
      config,
      options.selectedColumns,
      options.userPermissions
    );

    if (allowedColumns.length === 0) {
      throw new Error("Нет доступных колонок для экспорта");
    }

    // Определяем ширину колонок
    worksheet.columns = allowedColumns.map((col) => ({
      key: col.key,
      width: this.getDefaultColumnWidth(col),
    }));

    // Заголовки
    const headerRow = worksheet.addRow(allowedColumns.map((col) => col.label));
    headerRow.height = 22;
    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL_COLOR },
      };
      cell.font = {
        bold: true,
        color: { argb: HEADER_FONT_COLOR },
        size: 10,
        name: "Calibri",
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: false,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF2C5282" } },
        left: { style: "thin", color: { argb: "FF2C5282" } },
        bottom: { style: "thin", color: { argb: "FF2C5282" } },
        right: { style: "thin", color: { argb: "FF2C5282" } },
      };
    });

    // Данные
    data.forEach((item, rowIndex) => {
      const rowValues = allowedColumns.map((col) => {
        const raw = this.getNestedValue(item, col.key);
        return this.formatValue(raw, col);
      });

      const dataRow = worksheet.addRow(rowValues);
      dataRow.height = 18;

      const isAlt = rowIndex % 2 === 1;

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = allowedColumns[colNumber - 1];

        if (isAlt) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ALT_ROW_COLOR },
          };
        }

        cell.font = { size: 10, name: "Calibri" };

        cell.border = {
          top: { style: "hair", color: { argb: BORDER_COLOR } },
          left: { style: "hair", color: { argb: BORDER_COLOR } },
          bottom: { style: "hair", color: { argb: BORDER_COLOR } },
          right: { style: "hair", color: { argb: BORDER_COLOR } },
        };

        if (col?.type === "number") {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          if (typeof cell.value === "number") {
            const isInt = Number.isInteger(cell.value);
            cell.numFmt = isInt ? "#,##0" : "#,##0.##";
          }
        } else if (col?.type === "date") {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "dd.mm.yyyy";
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });

    // Автоширина на основе содержимого
    worksheet.columns.forEach((column, colIdx) => {
      if (!column) return;
      const header = allowedColumns[colIdx]?.label || "";
      let maxLen = header.length + 2;

      column.eachCell({ includeEmpty: false }, (cell) => {
        if (!cell.value) return;
        const strLen =
          cell.value instanceof Date
            ? 12
            : String(cell.value).length;
        if (strLen > maxLen) maxLen = strLen;
      });

      column.width = Math.min(Math.max(maxLen + 1, 10), 55);
    });

    // Итоговая строка с суммами для числовых колонок
    const numericCols = allowedColumns
      .map((col, i) => ({ col, i }))
      .filter(({ col }) => col.type === "number");

    if (data.length > 0 && numericCols.length > 0) {
      const totalRowValues: (string | number | null)[] = allowedColumns.map(
        (col, i) => {
          if (col.type === "number") {
            const vals = data
              .map((item) => this.getNestedValue(item, col.key))
              .map((v) => (typeof v === "number" ? v : parseFloat(v)))
              .filter((v) => !isNaN(v));
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
          }
          return i === 0 ? "Итого:" : null;
        }
      );

      const totalRow = worksheet.addRow(totalRowValues);
      totalRow.height = 20;
      totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = allowedColumns[colNumber - 1];
        cell.font = { bold: true, size: 10, name: "Calibri" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F0F8" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF2C5282" } },
          left: { style: "hair", color: { argb: BORDER_COLOR } },
          bottom: { style: "thin", color: { argb: "FF2C5282" } },
          right: { style: "hair", color: { argb: BORDER_COLOR } },
        };
        if (col?.type === "number" && typeof cell.value === "number") {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          const isInt = Number.isInteger(cell.value);
          cell.numFmt = isInt ? "#,##0" : "#,##0.##";
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private filterColumnsByPermissions(
    config: ModuleExportConfig,
    selectedColumns: string[],
    userPermissions: string[]
  ): ColumnConfig[] {
    return config.columns
      .filter((col) => selectedColumns.includes(col.key))
      .filter((col) => {
        if (col.requiredPermission) {
          return userPermissions.includes(col.requiredPermission);
        }
        return col.exportable;
      });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private formatValue(value: any, column: ColumnConfig): any {
    if (value === null || value === undefined) return "";

    if (column.format) return column.format(value);

    switch (column.type) {
      case "date":
        if (!value) return "";
        try {
          return new Date(value);
        } catch {
          return String(value);
        }
      case "number": {
        const num = typeof value === "number" ? value : parseFloat(String(value));
        return isNaN(num) ? "" : num;
      }
      case "boolean":
        return value ? "Да" : "Нет";
      default:
        return String(value);
    }
  }

  private getDefaultColumnWidth(col: ColumnConfig): number {
    if (col.type === "date") return 14;
    if (col.type === "number") return 16;
    if (col.type === "boolean") return 10;
    const labelLen = col.label.length;
    return Math.max(labelLen + 4, 18);
  }

  getAvailableColumns(moduleName: string, userPermissions: string[]): ColumnConfig[] {
    const config = exportConfigRegistry[moduleName];
    if (!config) return [];

    return config.columns.filter((col) => {
      if (col.requiredPermission) {
        return userPermissions.includes(col.requiredPermission);
      }
      return col.exportable;
    });
  }
}
