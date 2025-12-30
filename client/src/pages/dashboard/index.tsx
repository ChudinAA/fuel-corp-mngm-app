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
import { Plus, Loader2, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWidgetComponent } from "./components/widget-registry";
import { WidgetSelector } from "./components/widget-selector";
import { TemplateManager } from "./components/template-manager";
import { DashboardConfiguration, WidgetDefinition, DashboardWidget } from "./types";
import { useToast } from "@/hooks/use-toast";

export default function CustomizableDashboard() {
  const [layout, setLayout] = useState<Layout[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: isLoadingConfig } = useQuery<DashboardConfiguration>({
    queryKey: ["/api/dashboard/configuration"],
    retry: 1,
  });

  const { data: availableWidgets } = useQuery<WidgetDefinition[]>({
    queryKey: ["/api/dashboard/widgets/available"],
  });

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
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить конфигурацию",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (config) {
      setLayout(config.layout || []);
      setWidgets(config.widgets || []);
      setHasUnsavedChanges(false);
    }
  }, [config]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [layout, widgets, hasUnsavedChanges]);

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout);
    setHasUnsavedChanges(true);
  }, []);

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

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Загрузка дашборда...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Дашборд</h1>
          <p className="text-muted-foreground">Настройте дашборд под свои нужды</p>
        </div>
      </div>

      <Tabs defaultValue="main" className="w-full">
        <TabsList>
          <TabsTrigger value="main">Главная</TabsTrigger>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowWidgetSelector(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Добавить виджет
            </Button>
          </div>

          {widgets.length > 0 ? (
            <GridLayout
              className="layout"
              layout={layout}
              onLayoutChange={handleLayoutChange}
              cols={12}
              rowHeight={100}
              width={1200}
              isDraggable={true}
              isResizable={true}
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
                    className="dashboard-grid-item"
                    onMouseEnter={() => setHoveredWidgetId(widget.id)}
                    onMouseLeave={() => setHoveredWidgetId(null)}
                  >
                    {hoveredWidgetId === widget.id && (
                      <button
                        onClick={() => handleRemoveWidget(widget.id)}
                        className="absolute top-2 right-2 z-50 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                        title="Удалить виджет"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
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
                        isEditMode={false}
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
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}