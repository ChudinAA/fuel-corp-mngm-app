
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Edit, Plus, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WidgetDefinition {
  id: string;
  widgetKey: string;
  name: string;
  description?: string;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  requiredPermissions: string[];
  configSchema?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

const WIDGET_CATEGORIES = [
  { value: "statistics", label: "Статистика" },
  { value: "finance", label: "Финансы" },
  { value: "warehouses", label: "Склады" },
  { value: "operations", label: "Операции" },
  { value: "analytics", label: "Аналитика" },
];

export default function WidgetsAdminPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetDefinition | null>(null);
  const [formData, setFormData] = useState({
    widgetKey: "",
    name: "",
    description: "",
    category: "statistics",
    defaultWidth: 4,
    defaultHeight: 2,
    minWidth: 2,
    minHeight: 1,
    requiredPermissions: "",
    isActive: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: widgets = [], isLoading } = useQuery<WidgetDefinition[]>({
    queryKey: ["/api/admin/widgets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          requiredPermissions: data.requiredPermissions.split(",").map((p: string) => p.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to create widget");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/widgets"] });
      toast({ title: "Виджет создан" });
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/widgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          requiredPermissions: data.requiredPermissions.split(",").map((p: string) => p.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to update widget");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/widgets"] });
      toast({ title: "Виджет обновлён" });
      handleCloseDialog();
    },
  });

  const handleEdit = (widget: WidgetDefinition) => {
    setEditingWidget(widget);
    setFormData({
      widgetKey: widget.widgetKey,
      name: widget.name,
      description: widget.description || "",
      category: widget.category,
      defaultWidth: widget.defaultWidth,
      defaultHeight: widget.defaultHeight,
      minWidth: widget.minWidth,
      minHeight: widget.minHeight,
      requiredPermissions: widget.requiredPermissions.join(", "),
      isActive: widget.isActive,
    });
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingWidget(null);
    setFormData({
      widgetKey: "",
      name: "",
      description: "",
      category: "statistics",
      defaultWidth: 4,
      defaultHeight: 2,
      minWidth: 2,
      minHeight: 1,
      requiredPermissions: "",
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingWidget(null);
  };

  const handleSubmit = () => {
    if (editingWidget) {
      updateMutation.mutate({ id: editingWidget.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Управление виджетами</h1>
          <p className="text-muted-foreground">Настройка доступных виджетов для дашборда</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Создать виджет
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ключ</TableHead>
            <TableHead>Название</TableHead>
            <TableHead>Категория</TableHead>
            <TableHead>Размер</TableHead>
            <TableHead>Права доступа</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {widgets.map((widget) => (
            <TableRow key={widget.id}>
              <TableCell className="font-mono text-sm">{widget.widgetKey}</TableCell>
              <TableCell>{widget.name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {WIDGET_CATEGORIES.find(c => c.value === widget.category)?.label || widget.category}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {widget.defaultWidth}x{widget.defaultHeight}
              </TableCell>
              <TableCell className="text-sm">
                {widget.requiredPermissions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {widget.requiredPermissions.map((perm, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Нет ограничений</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={widget.isActive ? "default" : "secondary"}>
                  {widget.isActive ? "Активен" : "Неактивен"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(widget)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWidget ? "Редактировать виджет" : "Создать виджет"}</DialogTitle>
            <DialogDescription>
              {editingWidget ? "Изменение параметров виджета" : "Добавление нового виджета в систему"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="widgetKey">Ключ виджета</Label>
                <Input
                  id="widgetKey"
                  value={formData.widgetKey}
                  onChange={(e) => setFormData({ ...formData, widgetKey: e.target.value })}
                  placeholder="my_widget"
                  disabled={!!editingWidget}
                />
              </div>
              <div>
                <Label htmlFor="category">Категория</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDGET_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Мой виджет"
              />
            </div>
            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Краткое описание виджета"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="defaultWidth">Ширина</Label>
                <Input
                  id="defaultWidth"
                  type="number"
                  min={1}
                  max={12}
                  value={formData.defaultWidth}
                  onChange={(e) => setFormData({ ...formData, defaultWidth: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="defaultHeight">Высота</Label>
                <Input
                  id="defaultHeight"
                  type="number"
                  min={1}
                  value={formData.defaultHeight}
                  onChange={(e) => setFormData({ ...formData, defaultHeight: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="minWidth">Мин. ширина</Label>
                <Input
                  id="minWidth"
                  type="number"
                  min={1}
                  max={12}
                  value={formData.minWidth}
                  onChange={(e) => setFormData({ ...formData, minWidth: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="minHeight">Мин. высота</Label>
                <Input
                  id="minHeight"
                  type="number"
                  min={1}
                  value={formData.minHeight}
                  onChange={(e) => setFormData({ ...formData, minHeight: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="permissions">Необходимые права (через запятую)</Label>
              <Input
                id="permissions"
                value={formData.requiredPermissions}
                onChange={(e) => setFormData({ ...formData, requiredPermissions: e.target.value })}
                placeholder="opt.view, refueling.view"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Оставьте пустым для виджета без ограничений доступа
              </p>
            </div>
            {/* <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Виджет активен</Label>
            </div> */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingWidget ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
