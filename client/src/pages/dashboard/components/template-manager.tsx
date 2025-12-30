
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download, Upload, CheckCircle2, Loader2 } from "lucide-react";

interface DashboardTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  roleId?: string;
  layout: any[];
  widgets: any[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function TemplateManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Загрузка всех шаблонов
  const { data: templates = [], isLoading } = useQuery<DashboardTemplate[]>({
    queryKey: ["/api/dashboard/templates"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
  });

  // Применить шаблон
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/dashboard/templates/${templateId}/apply`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to apply template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/configuration"] });
      toast({ 
        title: "Шаблон применён", 
        description: "Конфигурация дашборда обновлена. Перейдите на вкладку 'Главная' чтобы увидеть изменения." 
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось применить шаблон",
        variant: "destructive",
      });
    },
  });

  // Удалить шаблон
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/dashboard/templates/${templateId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/templates"] });
      toast({ title: "Шаблон удалён" });
    },
  });

  // Экспорт конфигурации
  const handleExport = async () => {
    try {
      const res = await fetch("/api/dashboard/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-config-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Экспорт завершён", description: "Конфигурация сохранена в файл" });
    } catch (error) {
      toast({ title: "Ошибка экспорта", variant: "destructive" });
    }
  };

  // Импорт конфигурации
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch("/api/dashboard/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Import failed");

      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/configuration"] });
      toast({ title: "Импорт завершён", description: "Конфигурация загружена" });
    } catch (error) {
      toast({ title: "Ошибка импорта", description: "Неверный формат файла", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Шаблоны дашбордов</h2>
          <p className="text-muted-foreground">Применяйте готовые шаблоны для быстрой настройки</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} title="Экспортировать текущую конфигурацию дашборда в JSON файл">
            <Download className="mr-2 h-4 w-4" />
            Экспорт
          </Button>
          <label title="Импортировать конфигурацию дашборда из JSON файла">
            <Button variant="outline" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Импорт
              </span>
            </Button>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                  {template.isSystem && (
                    <Badge variant="secondary">Системный</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Виджетов: {template.widgets.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => applyTemplateMutation.mutate(template.id)}
                      disabled={applyTemplateMutation.isPending}
                    >
                      {applyTemplateMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Применить
                    </Button>
                    {!template.isSystem && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTemplateMutation.mutate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            Нет доступных шаблонов. Создайте свой первый шаблон на вкладке "Главная".
          </p>
        </Card>
      )}
    </div>
  );
}
