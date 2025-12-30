import { useState, Suspense, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GridLayout, { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, X, Plus, Loader2, FileJson } from "lucide-react";
import { getWidgetComponent } from "./components/widget-registry";
import { WidgetSelector } from "./components/widget-selector";
import { DashboardConfiguration, WidgetDefinition, DashboardWidget } from "./types";
import { useToast } from "@/hooks/use-toast";

export default function CustomizableDashboard() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Placeholder for user authentication status - replace with actual auth hook
  const user = true; // Assume user is logged in for now

  // Загрузка конфигурации дашборда
  const { data: config, isLoading: isLoadingConfig, error: configError } = useQuery<DashboardConfiguration>({
    queryKey: ["/api/dashboard/configuration"],
    enabled: !!user,
    retry: false,
  });

  // Загрузка доступных виджетов
  const { data: availableWidgets } = useQuery<WidgetDefinition[]>({
    queryKey: ["/api/dashboard/widgets/available"],
  });

  // Мутация для сохранения конфигурации
  const saveMutation = useMutation({
    mutationFn: async (data: { layout: Layout[]; widgets: DashboardWidget[] }) => {
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
        title: "Сохранено",
        description: "Конфигурация дашборда успешно обновлена",
      });
      setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
    }
  }, [config]);

  // Auto-save при изменении layout (с debounce)
  useEffect(() => {
    if (!isEditMode || !hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 3000); // Auto-save через 3 секунды после последнего изменения

    return () => clearTimeout(timer);
  }, [layout, widgets, isEditMode, hasUnsavedChanges]);

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    if (!isEditMode) return;
    setLayout(newLayout);
    setHasUnsavedChanges(true);
  }, [isEditMode]);

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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);

    toast({
      title: "Виджет добавлен",
      description: `${widgetDef.name} добавлен на дашборд`,
    });
  };

  const handleCancelEdit = () => {
    if (config) {
      setLayout(config.layout || []);
      setWidgets(config.widgets || []);
    }
    setHasUnsavedChanges(false);
    setIsEditMode(false);
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
  };

  // Show loading state while configuration loads
  if (isLoadingConfig || configError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Загрузка дашборда...</span>
      </div>
    );
  }

  // If user is not authenticated, don't render dashboard
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Дашборд</h1>
          <p className="text-muted-foreground">Настройте дашборд под свои нужды</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = "/dashboard/templates"}>
            <FileJson className="mr-2 h-4 w-4" />
            Шаблоны
          </Button>
          {isEditMode ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="mr-2 h-4 w-4" />
                Отменить
              </Button>
              <Button onClick={handleSave} disabled={!hasUnsavedChanges || saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Сохранить
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Редактировать
            </Button>
          )}
        </div>
      </div>

      {isEditMode && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <Edit className="h-4 w-4" />
              <span className="font-medium">Режим редактирования активен</span>
              <span className="text-muted-foreground">— перетаскивайте и изменяйте размер виджетов</span>
            </div>
            <Button onClick={() => setShowWidgetSelector(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Добавить виджет
            </Button>
          </div>
        </Card>
      )}

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
          margin={[16, 16]}
          containerPadding={[0, 0]}
        >
          {widgets.map(widget => {
            const WidgetComponent = getWidgetComponent(widget.widgetKey);
            if (!WidgetComponent) return null;

            return (
              <div
                key={widget.id}
                className={`dashboard-grid-item ${isEditMode ? 'editing' : ''}`}
              >
                <Suspense
                  fallback={
                    <Card className="h-full flex items-center justify-center">
                      <Skeleton className="h-24 w-24" />
                    </Card>
                  }
                >
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