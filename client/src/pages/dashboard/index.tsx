
import { useState, Suspense, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Save, X, Plus } from "lucide-react";
import { getWidgetComponent } from "./components/widget-registry";
import { WidgetSelector } from "./components/widget-selector";
import { DashboardConfiguration, WidgetDefinition, DashboardWidget } from "./types";
import { useToast } from "@/hooks/use-toast";

export default function CustomizableDashboard() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Загрузка конфигурации дашборда
  const { data: config, isLoading: isLoadingConfig } = useQuery<DashboardConfiguration>({
    queryKey: ["/api/dashboard/configuration"],
  });

  // Загрузка доступных виджетов
  const { data: availableWidgets } = useQuery<WidgetDefinition[]>({
    queryKey: ["/api/dashboard/widgets/available"],
  });

  // Мутация для сохранения конфигурации
  const saveMutation = useMutation({
    mutationFn: async (data: { layout: Layout[]; widgets: any[] }) => {
      const response = await fetch("/api/dashboard/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to save configuration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/configuration"] });
      toast({
        title: "Успешно сохранено",
        description: "Конфигурация дашборда обновлена",
      });
      setIsEditMode(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить конфигурацию",
        variant: "destructive",
      });
    },
  });

  // Синхронизация layout и widgets с конфигурацией
  useEffect(() => {
    if (config) {
      setLayout(config.layout || []);
      setWidgets(config.widgets || []);
    }
  }, [config]);

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout);
  };

  const handleSave = () => {
    const updatedWidgets = layout.map(item => {
      const existingWidget = widgets.find(w => w.id === item.i);
      return {
        id: item.i,
        widgetKey: existingWidget?.widgetKey || item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        config: existingWidget?.config,
      };
    });

    saveMutation.mutate({
      layout,
      widgets: updatedWidgets,
    });
  };

  const handleRemoveWidget = (widgetId: string) => {
    setLayout(prev => prev.filter(item => item.i !== widgetId));
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const handleAddWidget = (widgetDef: WidgetDefinition) => {
    const newWidgetId = `${widgetDef.widgetKey}-${Date.now()}`;
    
    // Найти свободное место в сетке
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    
    const newWidget: DashboardWidget = {
      id: newWidgetId,
      widgetKey: widgetDef.widgetKey,
      x: 0,
      y: maxY,
      w: widgetDef.defaultWidth,
      h: widgetDef.defaultHeight,
    };

    const newLayoutItem: Layout = {
      i: newWidgetId,
      x: 0,
      y: maxY,
      w: widgetDef.defaultWidth,
      h: widgetDef.defaultHeight,
      minW: widgetDef.minWidth,
      minH: widgetDef.minHeight,
    };

    setWidgets(prev => [...prev, newWidget]);
    setLayout(prev => [...prev, newLayoutItem]);
    setShowWidgetSelector(false);
    
    toast({
      title: "Виджет добавлен",
      description: `${widgetDef.name} добавлен на дашборд`,
    });
  };

  const handleCancel = () => {
    if (config) {
      setLayout(config.layout || []);
      setWidgets(config.widgets || []);
    }
    setIsEditMode(false);
  };

  if (isLoadingConfig) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Дашборд</h1>
          <p className="text-muted-foreground">
            Обзор ключевых показателей системы
          </p>
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Сохранить
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditMode(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
              <Button variant="outline" onClick={() => setShowWidgetSelector(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить виджет
              </Button>
            </>
          )}
        </div>
      </div>

      {widgets.length > 0 ? (
        <GridLayout
          className="layout"
          layout={layout}
          onLayoutChange={handleLayoutChange}
          cols={12}
          rowHeight={100}
          width={1200}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          compactType="vertical"
          preventCollision={false}
        >
          {widgets.map(widget => {
            const WidgetComponent = getWidgetComponent(widget.widgetKey);
            if (!WidgetComponent) return null;

            return (
              <div key={widget.id} className="dashboard-grid-item">
                <Suspense fallback={<Card className="h-full flex items-center justify-center"><Skeleton className="h-24 w-24" /></Card>}>
                  <WidgetComponent
                    widgetKey={widget.widgetKey}
                    config={widget.config}
                    isEditMode={isEditMode}
                    onRemove={() => handleRemoveWidget(widget.id)}
                  />
                </Suspense>
              </div>
            );
          })}
        </GridLayout>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">
            У вас пока нет виджетов на дашборде
          </p>
          <Button onClick={() => setShowWidgetSelector(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить первый виджет
          </Button>
        </Card>
      )}

      <WidgetSelector
        open={showWidgetSelector}
        onOpenChange={setShowWidgetSelector}
        onAddWidget={handleAddWidget}
        currentWidgets={widgets.map(w => w.widgetKey)}
      />
    </div>
  );
}
