import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Train, Truck, User, Tag } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface SupplyTag {
  id: string;
  warehouseId: string;
  label: string;
  type: string;
  supplierId?: string | null;
  supplierName?: string | null;
  color: string;
}

interface PlanningResource {
  id: string;
  supplierId: string;
  supplierName: string;
}

const TAG_TYPES = [
  { value: "railway", label: "ЖД", icon: Train },
  { value: "auto", label: "Авто", icon: Truck },
  { value: "supplier", label: "Поставщик", icon: User },
  { value: "custom", label: "Другое", icon: Tag },
];

const TAG_TYPE_COLORS: Record<string, string> = {
  railway: "blue",
  auto: "green",
  supplier: "orange",
  custom: "gray",
};

const TAG_COLORS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  gray: "bg-muted text-muted-foreground",
};

export function getTagColorClass(color: string): string {
  return TAG_COLORS[color] ?? TAG_COLORS.blue;
}

export function getTagIcon(type: string) {
  const found = TAG_TYPES.find((t) => t.value === type);
  if (!found) return Tag;
  return found.icon;
}

export function getTagTypeLabel(type: string): string {
  return TAG_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface WarehouseSupplyTagsProps {
  warehouseId: string;
  warehouseName: string;
  scenarioId?: string | null;
}

export function WarehouseSupplyTagsBadges({ warehouseId, scenarioId }: { warehouseId: string; scenarioId?: string | null }) {
  const params = new URLSearchParams({ warehouseId });
  if (scenarioId) params.set("scenarioId", scenarioId);

  const { data: tags = [] } = useQuery<SupplyTag[]>({
    queryKey: ["/api/planning/warehouse-tags", warehouseId, scenarioId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/warehouse-tags?${params}`)).json(),
  });

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((tag) => {
        const Icon = getTagIcon(tag.type);
        return (
          <Badge
            key={tag.id}
            variant="outline"
            className={`text-xs gap-1 px-1.5 py-0.5 ${getTagColorClass(tag.color)}`}
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            {tag.type === "supplier" && tag.supplierName
              ? tag.supplierName
              : tag.label}
          </Badge>
        );
      })}
    </div>
  );
}

export function WarehouseSupplyTagsDialog({ warehouseId, warehouseName, scenarioId }: WarehouseSupplyTagsProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("planning", "allocate");

  const [open, setOpen] = useState(false);
  const [formType, setFormType] = useState("railway");
  const [formLabel, setFormLabel] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");

  const tagsParams = new URLSearchParams({ warehouseId });
  if (scenarioId) tagsParams.set("scenarioId", scenarioId);

  const { data: tags = [], isLoading } = useQuery<SupplyTag[]>({
    queryKey: ["/api/planning/warehouse-tags", warehouseId, scenarioId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/warehouse-tags?${tagsParams}`)).json(),
    enabled: open,
  });

  // Load planning resources (not all suppliers)
  const { data: resources = [] } = useQuery<PlanningResource[]>({
    queryKey: ["/api/planning/resources"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/resources")).json(),
    enabled: open && formType === "supplier",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const autoColor = TAG_TYPE_COLORS[formType] || "blue";
      let label: string;
      if (formType === "supplier") {
        label = resources.find((r) => r.supplierId === formSupplierId)?.supplierName || "Поставщик";
      } else if (formType === "custom") {
        label = formLabel || "Другое";
      } else {
        label = getTagTypeLabel(formType);
      }
      await apiRequest("POST", "/api/planning/warehouse-tags", {
        warehouseId,
        label,
        type: formType,
        supplierId: formType === "supplier" ? (formSupplierId || null) : null,
        color: autoColor,
        scenarioId: scenarioId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/warehouse-tags", warehouseId, scenarioId] });
      toast({ title: "Метка добавлена" });
      setFormLabel("");
      setFormSupplierId("");
      setFormType("railway");
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/planning/warehouse-tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/warehouse-tags", warehouseId, scenarioId] });
      toast({ title: "Метка удалена" });
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Метки поставок"
          data-testid={`button-supply-tags-${warehouseId}`}
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-3" align="start">
        <div className="font-medium text-sm">{warehouseName} — поставка</div>

        {/* Existing tags */}
        <div className="space-y-1.5">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Загрузка...</p>
          ) : tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет меток</p>
          ) : (
            tags.map((tag) => {
              const Icon = getTagIcon(tag.type);
              return (
                <div key={tag.id} className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 flex-1 ${getTagColorClass(tag.color)}`}
                  >
                    <Icon className="h-3 w-3" />
                    {tag.type === "supplier" && tag.supplierName
                      ? tag.supplierName
                      : tag.label}
                    {tag.type !== "supplier" && (
                      <span className="text-xs opacity-70 ml-1">({getTagTypeLabel(tag.type)})</span>
                    )}
                  </Badge>
                  {canManage && (
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => deleteMutation.mutate(tag.id)}
                      title="Удалить"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add form */}
        {canManage && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Добавить метку</p>
            <div className="space-y-1">
              <Label className="text-xs">Тип поставки</Label>
              <Select value={formType} onValueChange={(v) => { setFormType(v); setFormLabel(""); setFormSupplierId(""); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formType === "supplier" && (
              <div className="space-y-1">
                <Label className="text-xs">Поставщик</Label>
                <Select value={formSupplierId} onValueChange={setFormSupplierId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.length === 0 ? (
                      <SelectItem value="_none" disabled className="text-xs text-muted-foreground">
                        Нет ресурсов в плане
                      </SelectItem>
                    ) : (
                      resources.map((r) => (
                        <SelectItem key={r.supplierId} value={r.supplierId} className="text-xs">
                          {r.supplierName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formType === "custom" && (
              <div className="space-y-1">
                <Label className="text-xs">Текст метки</Label>
                <Input
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Название..."
                  className="h-8 text-xs"
                />
              </div>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                (formType === "supplier" && !formSupplierId) ||
                (formType === "custom" && !formLabel.trim())
              }
              data-testid={`button-add-supply-tag-${warehouseId}`}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Добавить метку
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
