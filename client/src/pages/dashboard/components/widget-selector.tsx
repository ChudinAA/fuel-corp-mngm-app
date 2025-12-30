
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { WidgetDefinition } from "../types";

interface WidgetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: WidgetDefinition) => void;
  currentWidgets: string[];
}

export function WidgetSelector({
  open,
  onOpenChange,
  onAddWidget,
  currentWidgets,
}: WidgetSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: widgets, isLoading } = useQuery<WidgetDefinition[]>({
    queryKey: ["/api/dashboard/widgets/available"],
  });

  // Группируем виджеты по категориям для подсчета
  const widgetsByCategory = widgets?.reduce((acc, widget) => {
    if (!acc[widget.category]) {
      acc[widget.category] = [];
    }
    acc[widget.category].push(widget);
    return acc;
  }, {} as Record<string, WidgetDefinition[]>) || {};

  // Получаем только категории, в которых есть виджеты после фильтрации
  const availableCategories = Object.keys(widgetsByCategory)
    .filter(category => {
      const categoryWidgets = widgetsByCategory[category];
      if (searchQuery === "") return true;
      return categoryWidgets.some(w => 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .sort();

  const filteredWidgets = widgets?.filter(widget => {
    const matchesCategory = selectedCategory === "all" || widget.category === selectedCategory;
    const matchesSearch = searchQuery === "" || 
      widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      widget.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      statistics: "Статистика",
      operations: "Операции",
      warehouses: "Склады",
      finance: "Финансы",
      analytics: "Аналитика",
    };
    return labels[category] || category;
  };

  const getCategoryCount = (category: string) => {
    if (category === "all") {
      return widgets?.length || 0;
    }
    return widgetsByCategory[category]?.length || 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Добавить виджет</DialogTitle>
          <DialogDescription>
            Выберите виджет для добавления на дашборд
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск виджетов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full auto-cols-fr" style={{ gridTemplateColumns: `repeat(${Math.min(availableCategories.length + 1, 6)}, 1fr)` }}>
            <TabsTrigger value="all">
              Все ({getCategoryCount("all")})
            </TabsTrigger>
            {availableCategories.slice(0, 5).map(category => (
              <TabsTrigger key={category} value={category}>
                {getCategoryLabel(category)} ({getCategoryCount(category)})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid gap-4 md:grid-cols-2">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                    Загрузка...
                  </p>
                ) : filteredWidgets && filteredWidgets.length > 0 ? (
                  filteredWidgets.map(widget => {
                    const isAdded = currentWidgets.includes(widget.widgetKey);
                    return (
                      <Card key={widget.id} className={isAdded ? "opacity-50" : ""}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">
                                {widget.name}
                              </CardTitle>
                              {widget.description && (
                                <CardDescription className="mt-1">
                                  {widget.description}
                                </CardDescription>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Badge variant="secondary">
                                  {getCategoryLabel(widget.category)}
                                </Badge>
                                {widget.requiredPermissions && widget.requiredPermissions.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    Требует прав
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={isAdded ? "ghost" : "default"}
                              disabled={isAdded}
                              onClick={() => onAddWidget(widget)}
                            >
                              {isAdded ? (
                                "Добавлен"
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Добавить
                                </>
                              )}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Размер: {widget.defaultWidth}x{widget.defaultHeight}
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center py-12">
                    <p className="text-sm text-muted-foreground mb-2">
                      {searchQuery 
                        ? `Нет виджетов по запросу "${searchQuery}"`
                        : selectedCategory === "all" 
                          ? "Нет доступных виджетов" 
                          : `Нет виджетов в категории "${getCategoryLabel(selectedCategory)}"`}
                    </p>
                    {(selectedCategory !== "all" || searchQuery) && (
                      <Button 
                        variant="link" 
                        onClick={() => {
                          setSelectedCategory("all");
                          setSearchQuery("");
                        }}
                      >
                        Сбросить фильтры
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
