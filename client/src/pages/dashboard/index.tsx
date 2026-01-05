import { useState, Suspense, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import GridLayout, { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, X, Save, GripVertical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWidgetComponent } from "./components/widget-registry";
import { WidgetSelector } from "./components/widget-selector";
import { TemplateManager } from "./components/template-manager";
import { DashboardConfiguration, WidgetDefinition, DashboardWidget } from "./types";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CustomizableDashboard() {
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [gridWidth, setGridWidth] = useState(1200);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: isLoadingConfig } = useQuery<DashboardConfiguration>({
    queryKey: ["/api/dashboard/configuration"],
    retry: 1,
  });

  // Update grid width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      const container = document.querySelector('.dashboard-container');
      if (container) {
        setGridWidth(container.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: { layout: LayoutItem[]; widgets: DashboardWidget[]; silent?: boolean }) => {
      // Clean layout data before sending
      const cleanLayout = data.layout.map(({ i, x, y, w, h, minW, minH }) => ({
        i, x, y, w, h, minW, minH
      }));

      const response = await fetch("/api/dashboard/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: cleanLayout, widgets: data.widgets }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to save configuration");
      return { ...await response.json(), silent: data.silent };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/configuration"] });
      if (!data.silent) {
        toast({
          title: "Сохранено",
          description: "Конфигурация дашборда успешно обновлена",
        });
      }
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

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/dashboard/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          category: "user",
          layout,
          widgets,
        }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/templates"] });
      setShowCreateTemplateDialog(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      toast({ 
        title: "Шаблон создан", 
        description: "Текущая конфигурация сохранена как шаблон" 
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать шаблон",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (config) {
      // Clean layout data when loading
      const cleanLayout = (config.layout || []).map((item: any) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW || 2,
        minH: item.minH || 2
      }));
      setLayout(cleanLayout as LayoutItem[]);
      setWidgets(config.widgets || []);
      setHasUnsavedChanges(false);
    }
  }, [config]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [layout, widgets, hasUnsavedChanges]);

  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    if (!newLayout || newLayout.length === 0) return;
    
    const cleanLayout = newLayout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW || 2,
      minH: item.minH || 2
    }));
    
    // Only update and mark as unsaved if there's an actual change in coordinates or dimensions
    setLayout(prev => {
      const isDifferent = JSON.stringify(cleanLayout) !== JSON.stringify(prev);
      if (isDifferent) {
        setHasUnsavedChanges(true);
        return cleanLayout;
      }
      return prev;
    });
  }, []);

  const handleSave = (silent: boolean = false) => {
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
      silent,
    });
  };

  const handleRemoveWidget = (widgetId: string) => {
    setLayout(prev => prev.filter(item => item.i !== widgetId));
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setHasUnsavedChanges(true);
  };

  const handleAddWidget = (widgetDef: WidgetDefinition) => {
    const newWidgetId = `${widgetDef.widgetKey}-${Date.now()}`;

    // Find a free spot in the grid using improved collision detection
    let targetX = 0;
    let targetY = 0;

    // Check if a position overlaps with any existing widget
    const isPositionFree = (x: number, y: number, w: number, h: number): boolean => {
      return !layout.some(item => {
        const horizontalOverlap = x < item.x + item.w && x + w > item.x;
        const verticalOverlap = y < item.y + item.h && y + h > item.y;
        return horizontalOverlap && verticalOverlap;
      });
    };

    // Try to find empty space row by row
    let found = false;
    for (let y = 0; y < 50 && !found; y++) {
      for (let x = 0; x <= 12 - widgetDef.defaultWidth && !found; x++) {
        if (isPositionFree(x, y, widgetDef.defaultWidth, widgetDef.defaultHeight)) {
          targetX = x;
          targetY = y;
          found = true;
        }
      }
    }

    // If no free spot found, add to bottom
    if (!found) {
      targetX = 0;
      targetY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    }

    const newWidget: DashboardWidget = {
      id: newWidgetId,
      widgetKey: widgetDef.widgetKey,
      x: targetX,
      y: targetY,
      w: widgetDef.defaultWidth,
      h: widgetDef.defaultHeight,
    };

    const newLayoutItem: LayoutItem = {
      i: newWidgetId,
      x: targetX,
      y: targetY,
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

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название шаблона",
        variant: "destructive",
      });
      return;
    }
    createTemplateMutation.mutate({
      name: newTemplateName,
      description: newTemplateDescription,
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
        {activeTab === "main" && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateTemplateDialog(true)} variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Создать шаблон из текущего
            </Button>
            <Button onClick={() => setShowWidgetSelector(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Добавить виджет
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="main">Главная</TabsTrigger>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-6">
          <div className="dashboard-container w-full min-h-[500px]">
            {widgets.length > 0 ? (
                <GridLayout
                  className="layout"
                  layout={layout}
                  onLayoutChange={(l) => handleLayoutChange([...l])}
                  onDragStop={(l) => handleLayoutChange([...l])}
                  onResizeStop={(l) => handleLayoutChange([...l])}
                  cols={12}
                  rowHeight={100}
                  width={gridWidth}
                  isDraggable={true}
                  isResizable={true}
                  draggableHandle=".drag-handle"
                  compactType="vertical"
                  preventCollision={false}
                  margin={[16, 16]}
                  containerPadding={[0, 0]}
                  useCSSTransforms={true}
                  measureBeforeMount={false}
                >
                {widgets.map(widget => {
                  const WidgetComponent = getWidgetComponent(widget.widgetKey);
                  if (!WidgetComponent) return null;

                  return (
                    <div
                      key={widget.id}
                      className="dashboard-grid-item group relative"
                      onMouseEnter={() => setHoveredWidgetId(widget.id)}
                      onMouseLeave={() => setHoveredWidgetId(null)}
                    >
                      <div className="absolute top-2 right-2 z-[60] flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveWidget(widget.id);
                          }}
                          className="p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                          title="Удалить виджет"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
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
          </div>

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

      <Dialog open={showCreateTemplateDialog} onOpenChange={setShowCreateTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать шаблон</DialogTitle>
            <DialogDescription>
              Сохраните текущую конфигурацию дашборда как шаблон
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Название шаблона</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Мой дашборд"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Описание (необязательно)</Label>
              <Textarea
                id="template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Краткое описание шаблона..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTemplateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending}>
              {createTemplateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}