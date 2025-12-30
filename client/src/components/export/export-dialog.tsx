
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2 } from "lucide-react";

interface ExportDialogProps {
  moduleName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ColumnConfig {
  key: string;
  label: string;
  type: string;
  exportable: boolean;
  requiredPermission?: string;
  sensitive?: boolean;
}

export function ExportDialog({ moduleName, isOpen, onClose }: ExportDialogProps) {
  const { toast } = useToast();
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Получение доступных колонок
  const { data: columnsData, isLoading } = useQuery({
    queryKey: [`/api/export/${moduleName}/columns`],
    enabled: isOpen,
  });

  // Установка колонок по умолчанию при загрузке
  useEffect(() => {
    if (columnsData?.defaultColumns) {
      setSelectedColumns(columnsData.defaultColumns);
    }
  }, [columnsData]);

  // Установка имени файла по умолчанию
  useEffect(() => {
    if (columnsData?.displayName) {
      const date = new Date().toISOString().split('T')[0];
      setFileName(`${columnsData.displayName}_${date}.xlsx`);
    }
  }, [columnsData]);

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === columnsData?.columns?.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columnsData?.columns?.map((col: ColumnConfig) => col.key) || []);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedColumns,
          fileName,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Ошибка экспорта");
      }

      // Скачивание файла
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
        title: "Экспорт завершен",
        description: "Файл успешно сохранен",
      });

      onClose();
    } catch (error) {
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать данные",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Экспорт в Excel</DialogTitle>
          <DialogDescription>
            {columnsData?.displayName || "Выберите колонки для экспорта"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Имя файла</Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="export.xlsx"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Выберите колонки для экспорта</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={isLoading}
              >
                {selectedColumns.length === columnsData?.columns?.length
                  ? "Снять все"
                  : "Выбрать все"}
              </Button>
            </div>

            <ScrollArea className="h-[300px] border rounded-md p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {columnsData?.columns?.map((column: ColumnConfig) => (
                    <div key={column.key} className="flex items-start space-x-3">
                      <Checkbox
                        id={column.key}
                        checked={selectedColumns.includes(column.key)}
                        onCheckedChange={() => handleColumnToggle(column.key)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={column.key}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {column.label}
                          {column.sensitive && (
                            <span className="ml-2 text-xs text-orange-500">(чувствительные данные)</span>
                          )}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Тип: {column.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="text-sm text-muted-foreground">
            Выбрано колонок: {selectedColumns.length} из {columnsData?.columns?.length || 0}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Отмена
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedColumns.length === 0}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Экспортировать
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
