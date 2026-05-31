
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Settings2, Eye, Filter } from "lucide-react";
import type { ExportFilters } from "./export-button";

interface ExportDialogProps {
  moduleName: string;
  isOpen: boolean;
  onClose: () => void;
  exportFilters?: ExportFilters;
  previewData?: any[];
}

interface ColumnConfig {
  key: string;
  label: string;
  type: string;
  exportable: boolean;
  requiredPermission?: string;
  sensitive?: boolean;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

function formatCellValue(value: any, type: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "date") {
    try {
      return new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return String(value);
    }
  }
  if (type === "number") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(n)) return "—";
    return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  }
  if (type === "boolean") return value ? "Да" : "Нет";
  return String(value);
}

function hasActiveFilters(exportFilters?: ExportFilters): boolean {
  if (!exportFilters) return false;
  if (exportFilters.search) return true;
  if (exportFilters.columnFilters) {
    return Object.values(exportFilters.columnFilters).some((v) => v.length > 0);
  }
  return false;
}

export function ExportDialog({
  moduleName,
  isOpen,
  onClose,
  exportFilters,
  previewData = [],
}: ExportDialogProps) {
  const { toast } = useToast();
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");

  const { data: columnsData, isLoading } = useQuery({
    queryKey: [`/api/export/${moduleName}/columns`],
    enabled: isOpen,
  });

  useEffect(() => {
    if (columnsData?.defaultColumns) {
      setSelectedColumns(columnsData.defaultColumns);
    }
  }, [columnsData]);

  useEffect(() => {
    if (columnsData?.displayName) {
      const date = new Date().toISOString().split("T")[0];
      setFileName(`${columnsData.displayName}_${date}.xlsx`);
    }
  }, [columnsData]);

  // При закрытии возвращаем на вкладку настроек
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("settings");
    }
  }, [isOpen]);

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((k) => k !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSelectAll = () => {
    const allKeys = columnsData?.columns?.map((col: ColumnConfig) => col.key) || [];
    if (selectedColumns.length === allKeys.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(allKeys);
    }
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast({
        title: "Выберите колонки",
        description: "Необходимо выбрать хотя бы одну колонку для экспорта",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch(`/api/export/${moduleName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedColumns,
          fileName,
          exportFilters: exportFilters || {},
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Ошибка экспорта");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Экспорт завершён",
        description: `Файл «${fileName}» успешно сохранён`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Ошибка экспорта",
        description: error.message || "Не удалось экспортировать данные",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Колонки для предпросмотра — только выбранные в нужном порядке
  const previewColumns = useMemo<ColumnConfig[]>(() => {
    const allCols: ColumnConfig[] = columnsData?.columns || [];
    return allCols.filter((col) => selectedColumns.includes(col.key));
  }, [columnsData, selectedColumns]);

  const previewRows = previewData.slice(0, 50);
  const filtersActive = hasActiveFilters(exportFilters);
  const activeFilterCount = useMemo(() => {
    if (!exportFilters) return 0;
    let count = 0;
    if (exportFilters.search) count++;
    if (exportFilters.columnFilters) {
      count += Object.values(exportFilters.columnFilters).filter((v) => v.length > 0).length;
    }
    return count;
  }, [exportFilters]);

  const totalColumns = columnsData?.columns?.length || 0;
  const allSelected = selectedColumns.length === totalColumns && totalColumns > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DialogTitle className="text-lg">
              Экспорт в Excel — {columnsData?.displayName || moduleName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {filtersActive && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Filter className="h-3 w-3" />
                  {activeFilterCount} {activeFilterCount === 1 ? "фильтр" : "фильтра"} применено
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {selectedColumns.length} / {totalColumns} колонок
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pt-3">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="settings" className="gap-2 text-sm">
                <Settings2 className="h-3.5 w-3.5" />
                Настройки
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="gap-2 text-sm"
                disabled={selectedColumns.length === 0 || previewRows.length === 0}
              >
                <Eye className="h-3.5 w-3.5" />
                Предпросмотр
                {previewRows.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({previewRows.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Настройки ─── */}
          <TabsContent value="settings" className="flex-1 min-h-0 px-6 pb-4 mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Имя файла</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="export.xlsx"
                data-testid="input-export-filename"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Колонки для экспорта</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isLoading}
                  className="h-7 text-xs"
                >
                  {allSelected ? "Снять все" : "Выбрать все"}
                </Button>
              </div>

              <ScrollArea className="h-[280px] border rounded-md p-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {columnsData?.columns?.map((column: ColumnConfig) => (
                      <div key={column.key} className="flex items-center gap-3 py-0.5">
                        <Checkbox
                          id={`col-${column.key}`}
                          checked={selectedColumns.includes(column.key)}
                          onCheckedChange={() => handleColumnToggle(column.key)}
                          data-testid={`checkbox-col-${column.key}`}
                        />
                        <label
                          htmlFor={`col-${column.key}`}
                          className="flex-1 text-sm cursor-pointer leading-none select-none flex items-center gap-2"
                        >
                          <span>{column.label}</span>
                          {column.sensitive && (
                            <span className="text-xs text-orange-500 font-normal">(конф.)</span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {column.type === "date"
                              ? "дата"
                              : column.type === "number"
                              ? "число"
                              : column.type === "boolean"
                              ? "да/нет"
                              : "текст"}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {filtersActive && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                <span className="font-medium">Применены фильтры страницы.</span>{" "}
                В Excel войдут только отфильтрованные записи.
              </div>
            )}
          </TabsContent>

          {/* ─── Предпросмотр ─── */}
          <TabsContent value="preview" className="flex-1 min-h-0 px-6 pb-4 mt-3 flex flex-col gap-2">
            {previewRows.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Нет данных для предпросмотра
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Показаны первые {previewRows.length} записей из {previewData.length}
                  {filtersActive ? " (с применёнными фильтрами)" : ""}.
                  Итоговый файл будет содержать все записи.
                </p>
                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="min-w-max">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className="bg-[#1E3A5F] text-white">
                          <th className="px-2 py-1.5 text-left font-semibold border border-[#2C5282] whitespace-nowrap sticky left-0 bg-[#1E3A5F] z-10 min-w-[32px]">
                            №
                          </th>
                          {previewColumns.map((col) => (
                            <th
                              key={col.key}
                              className="px-2 py-1.5 text-center font-semibold border border-[#2C5282] whitespace-nowrap min-w-[80px]"
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row: any, rowIdx: number) => (
                          <tr
                            key={rowIdx}
                            className={
                              rowIdx % 2 === 0
                                ? "bg-background"
                                : "bg-[#F5F8FC] dark:bg-muted/30"
                            }
                          >
                            <td className="px-2 py-1 text-center text-muted-foreground border border-muted sticky left-0 bg-inherit z-10">
                              {rowIdx + 1}
                            </td>
                            {previewColumns.map((col) => {
                              const raw = getNestedValue(row, col.key);
                              const formatted = formatCellValue(raw, col.type);
                              return (
                                <td
                                  key={col.key}
                                  className={`px-2 py-1 border border-muted whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis ${
                                    col.type === "number" ? "text-right" : "text-left"
                                  }`}
                                  title={formatted !== "—" ? formatted : undefined}
                                >
                                  {formatted}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Отмена
          </Button>
          {previewRows.length > 0 && selectedColumns.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setActiveTab(activeTab === "preview" ? "settings" : "preview")}
              disabled={isExporting}
            >
              <Eye className="mr-2 h-4 w-4" />
              {activeTab === "preview" ? "Настройки" : "Предпросмотр"}
            </Button>
          )}
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedColumns.length === 0}
            data-testid="button-do-export"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать Excel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
