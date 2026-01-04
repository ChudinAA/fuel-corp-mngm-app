import { useState, Suspense, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import "./index.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, X, Save, GripVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface WidgetLayout {
  id: string;
  widgetKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

const GRID_COLS = 12;
const ROW_HEIGHT = 100;
const MIN_H = 2;
const MIN_W = 3;
const GAP = 16;

function checkCollision(
  widget: { x: number; y: number; w: number; h: number },
  other: { x: number; y: number; w: number; h: number }
): boolean {
  const horizontalOverlap = widget.x < other.x + other.w && widget.x + widget.w > other.x;
  const verticalOverlap = widget.y < other.y + other.h && widget.y + widget.h > other.y;
  return horizontalOverlap && verticalOverlap;
}

function hasCollisionWithOthers(
  widgetId: string,
  newPos: { x: number; y: number; w: number; h: number },
  allWidgets: WidgetLayout[]
): boolean {
  return allWidgets.some(other => {
    if (other.id === widgetId) return false;
    return checkCollision(newPos, other);
  });
}

export default function CustomizableDashboard() {
  const [widgetLayouts, setWidgetLayouts] = useState<WidgetLayout[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
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
    mutationFn: async (data: { widgets: WidgetLayout[]; silent?: boolean }) => {
      const layout = data.widgets.map((w) => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: MIN_W,
        minH: MIN_H,
      }));

      const widgets = data.widgets.map((w) => ({
        id: w.id,
        widgetKey: w.widgetKey,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        config: w.config,
      }));

      const response = await fetch("/api/dashboard/configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, widgets }),
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
      const layout = widgetLayouts.map((w) => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: MIN_W,
        minH: MIN_H,
      }));

      const widgets = widgetLayouts.map((w) => ({
        id: w.id,
        widgetKey: w.widgetKey,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        config: w.config,
      }));

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
      const layouts: WidgetLayout[] = (config.widgets || []).map((w, idx) => ({
        id: w.id,
        widgetKey: w.widgetKey,
        x: w.x ?? 0,
        y: w.y ?? idx,
        w: w.w ?? GRID_COLS,
        h: w.h ?? 3,
        config: w.config,
      }));
      
      setWidgetLayouts(layouts);
      setHasUnsavedChanges(false);
    }
  }, [config]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [widgetLayouts, hasUnsavedChanges]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-widget-id]') && !target.closest('.widget-controls')) {
        setSelectedWidget(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSave = (silent: boolean = false) => {
    saveMutation.mutate({ widgets: widgetLayouts, silent });
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgetLayouts(prev => prev.filter(w => w.id !== widgetId));
    setSelectedWidget(null);
    setHasUnsavedChanges(true);
  };

  const handleAddWidget = (widgetDef: WidgetDefinition) => {
    const newWidgetId = `${widgetDef.widgetKey}-${Date.now()}`;

    const maxY = widgetLayouts.reduce((max, w) => Math.max(max, w.y + w.h), 0);

    const newWidget: WidgetLayout = {
      id: newWidgetId,
      widgetKey: widgetDef.widgetKey,
      x: 0,
      y: maxY,
      w: widgetDef.defaultWidth ?? GRID_COLS,
      h: widgetDef.defaultHeight ?? 3,
    };

    setWidgetLayouts(prev => [...prev, newWidget]);
    setShowWidgetSelector(false);
    setHasUnsavedChanges(true);

    toast({
      title: "Виджет добавлен",
      description: `${widgetDef.name} добавлен на дашборд`,
    });
  };

  const handleMoveWidget = (widgetId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    setWidgetLayouts(prev => {
      const widget = prev.find(w => w.id === widgetId);
      if (!widget) return prev;
      
      let newX = widget.x;
      let newY = widget.y;
      
      switch (direction) {
        case 'up':
          newY = Math.max(0, widget.y - 1);
          break;
        case 'down':
          newY = widget.y + 1;
          break;
        case 'left':
          newX = Math.max(0, widget.x - 1);
          break;
        case 'right':
          newX = Math.min(GRID_COLS - widget.w, widget.x + 1);
          break;
      }
      
      const newPos = { x: newX, y: newY, w: widget.w, h: widget.h };
      
      const collidingWidget = prev.find(other => 
        other.id !== widgetId && checkCollision(newPos, other)
      );
      
      if (collidingWidget) {
        return prev.map(w => {
          if (w.id === widgetId) {
            return { ...w, x: newX, y: newY };
          }
          if (w.id === collidingWidget.id) {
            return { ...w, x: widget.x, y: widget.y };
          }
          return w;
        });
      }
      
      return prev.map(w => w.id === widgetId ? { ...w, x: newX, y: newY } : w);
    });
    setHasUnsavedChanges(true);
  };

  const handleWidthChange = (widgetId: string, delta: number) => {
    setWidgetLayouts(prev => {
      const widget = prev.find(w => w.id === widgetId);
      if (!widget) return prev;
      
      const newW = Math.max(MIN_W, Math.min(GRID_COLS - widget.x, widget.w + delta));
      const newPos = { x: widget.x, y: widget.y, w: newW, h: widget.h };
      
      if (hasCollisionWithOthers(widgetId, newPos, prev)) {
        return prev;
      }
      
      return prev.map(w => w.id === widgetId ? { ...w, w: newW } : w);
    });
    setHasUnsavedChanges(true);
  };

  const handleHeightChange = (widgetId: string, delta: number) => {
    setWidgetLayouts(prev => {
      const widget = prev.find(w => w.id === widgetId);
      if (!widget) return prev;
      
      const newH = Math.max(MIN_H, widget.h + delta);
      const newPos = { x: widget.x, y: widget.y, w: widget.w, h: newH };
      
      if (hasCollisionWithOthers(widgetId, newPos, prev)) {
        return prev;
      }
      
      return prev.map(w => w.id === widgetId ? { ...w, h: newH } : w);
    });
    setHasUnsavedChanges(true);
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

  const getMaxRow = () => {
    if (widgetLayouts.length === 0) return 1;
    return widgetLayouts.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Загрузка дашборда...</span>
      </div>
    );
  }

  const gridHeight = getMaxRow() * ROW_HEIGHT + (getMaxRow() - 1) * GAP + 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Дашборд</h1>
          <p className="text-muted-foreground">Выберите виджет для настройки его размера и позиции</p>
        </div>
        {activeTab === "main" && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateTemplateDialog(true)} variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Создать шаблон
            </Button>
            <Button onClick={() => setShowWidgetSelector(true)} size="sm" data-testid="button-add-widget">
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
          <div ref={containerRef} className="dashboard-container w-full">
            {widgetLayouts.length > 0 ? (
              <div 
                className="dashboard-grid relative"
                style={{ 
                  minHeight: gridHeight,
                }}
              >
                {widgetLayouts.map((widget) => {
                  const WidgetComponent = getWidgetComponent(widget.widgetKey);
                  if (!WidgetComponent) return null;

                  const isSelected = selectedWidget === widget.id;
                  const colWidth = `calc((100% - ${(GRID_COLS - 1) * GAP}px) / ${GRID_COLS})`;
                  
                  const left = `calc(${widget.x} * (${colWidth} + ${GAP}px))`;
                  const top = widget.y * (ROW_HEIGHT + GAP);
                  const width = `calc(${widget.w} * ${colWidth} + ${(widget.w - 1) * GAP}px)`;
                  const height = widget.h * ROW_HEIGHT + (widget.h - 1) * GAP;

                  return (
                    <div
                      key={widget.id}
                      data-widget-id={widget.id}
                      data-testid={`widget-${widget.id}`}
                      className={cn(
                        "absolute transition-all duration-200",
                        isSelected && "ring-2 ring-primary ring-offset-2 z-10"
                      )}
                      style={{
                        left,
                        top,
                        width,
                        height,
                      }}
                      onClick={() => setSelectedWidget(widget.id)}
                    >
                      <Card className="h-full flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs font-medium text-muted-foreground truncate">
                              {availableWidgets?.find(w => w.widgetKey === widget.widgetKey)?.name || widget.widgetKey}
                            </span>
                          </div>
                          
                          {isSelected && (
                            <div className="widget-controls flex items-center gap-1 flex-shrink-0">
                              <div className="flex items-center border rounded-md">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-r-none"
                                  onClick={(e) => { e.stopPropagation(); handleMoveWidget(widget.id, 'left'); }}
                                  disabled={widget.x === 0}
                                  title="Влево"
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-none border-x"
                                  onClick={(e) => { e.stopPropagation(); handleMoveWidget(widget.id, 'up'); }}
                                  disabled={widget.y === 0}
                                  title="Вверх"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-none border-r"
                                  onClick={(e) => { e.stopPropagation(); handleMoveWidget(widget.id, 'down'); }}
                                  title="Вниз"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-l-none"
                                  onClick={(e) => { e.stopPropagation(); handleMoveWidget(widget.id, 'right'); }}
                                  disabled={widget.x + widget.w >= GRID_COLS}
                                  title="Вправо"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex items-center border rounded-md ml-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-r-none"
                                  onClick={(e) => { e.stopPropagation(); handleWidthChange(widget.id, -1); }}
                                  disabled={widget.w <= MIN_W}
                                  title="Уже"
                                >
                                  <span className="text-[10px] font-bold">W-</span>
                                </Button>
                                <span className="text-[10px] px-1 border-x">{widget.w}/{GRID_COLS}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-l-none"
                                  onClick={(e) => { e.stopPropagation(); handleWidthChange(widget.id, 1); }}
                                  disabled={widget.x + widget.w >= GRID_COLS}
                                  title="Шире"
                                >
                                  <span className="text-[10px] font-bold">W+</span>
                                </Button>
                              </div>

                              <div className="flex items-center border rounded-md ml-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-r-none"
                                  onClick={(e) => { e.stopPropagation(); handleHeightChange(widget.id, -1); }}
                                  disabled={widget.h <= MIN_H}
                                  title="Ниже"
                                >
                                  <Minimize2 className="h-3 w-3" />
                                </Button>
                                <span className="text-[10px] px-1 border-x">{widget.h}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-l-none"
                                  onClick={(e) => { e.stopPropagation(); handleHeightChange(widget.id, 1); }}
                                  title="Выше"
                                >
                                  <Maximize2 className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                                onClick={(e) => { e.stopPropagation(); handleRemoveWidget(widget.id); }}
                                title="Удалить виджет"
                                data-testid={`button-remove-${widget.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 overflow-auto">
                          <Suspense
                            fallback={
                              <div className="h-full flex items-center justify-center">
                                <Skeleton className="h-24 w-24" />
                              </div>
                            }
                          >
                            <WidgetComponent
                              widgetKey={widget.widgetKey}
                              config={widget.config}
                              isEditMode={false}
                            />
                          </Suspense>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  У вас пока нет виджетов на дашборде
                </p>
                <Button onClick={() => setShowWidgetSelector(true)} data-testid="button-add-first-widget">
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
            currentWidgets={widgetLayouts.map(w => w.widgetKey)}
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
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Описание (необязательно)</Label>
              <Textarea
                id="template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Краткое описание шаблона..."
                data-testid="input-template-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTemplateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending} data-testid="button-create-template">
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
