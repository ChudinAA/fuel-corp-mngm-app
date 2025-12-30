
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

export class ExcelService {
  /**
   * Генерация Excel файла
   */
  async generateExcel(data: any[], options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const config = exportConfigRegistry[options.moduleName];

    if (!config) {
      throw new Error(`Export configuration not found for module: ${options.moduleName}`);
    }

    const worksheet = workbook.addWorksheet(options.sheetName || config.displayName);

    // Фильтрация колонок по правам доступа
    const allowedColumns = this.filterColumnsByPermissions(
      config,
      options.selectedColumns,
      options.userPermissions
    );

    // Добавление заголовков
    if (options.includeHeaders !== false) {
      const headers = allowedColumns.map(col => col.label);
      worksheet.addRow(headers);

      // Стилизация заголовков
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Добавление данных
    for (const item of data) {
      const row = allowedColumns.map(col => {
        const value = this.getNestedValue(item, col.key);
        return this.formatValue(value, col);
      });
      worksheet.addRow(row);
    }

    // Автоматическая ширина колонок
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Генерация буфера
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Фильтрация колонок по правам доступа
   */
  private filterColumnsByPermissions(
    config: ModuleExportConfig,
    selectedColumns: string[],
    userPermissions: string[]
  ): ColumnConfig[] {
    const allColumns = config.columns.filter(col => selectedColumns.includes(col.key));

    return allColumns.filter(col => {
      // Если колонка требует специального разрешения
      if (col.requiredPermission) {
        return userPermissions.includes(col.requiredPermission);
      }
      // Если колонка экспортируемая
      return col.exportable;
    });
  }

  /**
   * Получение вложенного значения (например, "supplier.name")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Форматирование значения в зависимости от типа
   */
  private formatValue(value: any, column: ColumnConfig): any {
    if (value === null || value === undefined) {
      return '';
    }

    // Пользовательское форматирование
    if (column.format) {
      return column.format(value);
    }

    // Форматирование по типу
    switch (column.type) {
      case 'date':
        return new Date(value);
      case 'number':
        return typeof value === 'number' ? value : parseFloat(value);
      case 'boolean':
        return value ? 'Да' : 'Нет';
      default:
        return String(value);
    }
  }

  /**
   * Получение списка доступных колонок для пользователя
   */
  getAvailableColumns(moduleName: string, userPermissions: string[]): ColumnConfig[] {
    const config = exportConfigRegistry[moduleName];
    if (!config) {
      return [];
    }

    return config.columns.filter(col => {
      if (col.requiredPermission) {
        return userPermissions.includes(col.requiredPermission);
      }
      return col.exportable;
    });
  }
}
