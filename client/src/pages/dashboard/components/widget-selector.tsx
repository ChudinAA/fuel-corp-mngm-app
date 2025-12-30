
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
import { Plus } from "lucide-react";
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

  const { data: widgets, isLoading } = useQuery<WidgetDefinition[]>({
    queryKey: ["/api/dashboard/widgets/available"],
  });

  const categories = widgets
    ? Array.from(new Set(widgets.map(w => w.category)))
    : [];

  const filteredWidgets = widgets?.filter(
    widget =>
      selectedCategory === "all" || widget.category === selectedCategory
  );

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Добавить виджет</DialogTitle>
          <DialogDescription>
            Выберите виджет для добавления на дашборд
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">Все</TabsTrigger>
            {categories.slice(0, 5).map(category => (
              <TabsTrigger key={category} value={category}>
                {getCategoryLabel(category)}
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
                              <Badge variant="secondary" className="mt-2">
                                {getCategoryLabel(widget.category)}
                              </Badge>
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
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                    Нет доступных виджетов
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
