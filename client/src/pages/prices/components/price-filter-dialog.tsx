
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";
import type { PriceFilterState } from "../types";

interface PriceFilterDialogProps {
  onApplyFilter: (filters: PriceFilterState) => void;
  currentFilters: PriceFilterState;
}

export function PriceFilterDialog({ onApplyFilter, currentFilters }: PriceFilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<PriceFilterState>(currentFilters);

  const handleApply = () => {
    onApplyFilter(filters);
    setOpen(false);
  };

  const handleReset = () => {
    const defaultFilters: PriceFilterState = {
      counterpartyType: "all",
      counterpartyRole: "all",
      productType: "all",
      showArchived: false,
    };
    setFilters(defaultFilters);
    onApplyFilter(defaultFilters);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Фильтр
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Детальный фильтр</DialogTitle>
          <DialogDescription>Настройте параметры фильтрации цен</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Дата от</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Дата до</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="counterpartyType">Тип сделки</Label>
            <Select
              value={filters.counterpartyType}
              onValueChange={(value: "all" | "wholesale" | "refueling") =>
                setFilters({ ...filters, counterpartyType: value })
              }
            >
              <SelectTrigger id="counterpartyType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="wholesale">ОПТ</SelectItem>
                <SelectItem value="refueling">Заправка ВС</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="counterpartyRole">Роль контрагента</Label>
            <Select
              value={filters.counterpartyRole}
              onValueChange={(value: "all" | "supplier" | "buyer") =>
                setFilters({ ...filters, counterpartyRole: value })
              }
            >
              <SelectTrigger id="counterpartyRole">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все роли</SelectItem>
                <SelectItem value="supplier">Поставщик</SelectItem>
                <SelectItem value="buyer">Покупатель</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType">Тип продукта</Label>
            <Select
              value={filters.productType}
              onValueChange={(value) => setFilters({ ...filters, productType: value })}
            >
              <SelectTrigger id="productType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все продукты</SelectItem>
                <SelectItem value="kerosine">Керосин</SelectItem>
                <SelectItem value="service">Услуги</SelectItem>
                <SelectItem value="pvkj">ПВКЖ</SelectItem>
                <SelectItem value="agent">Агентское</SelectItem>
                <SelectItem value="storage">Хранение</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="showArchived"
              checked={filters.showArchived}
              onCheckedChange={(checked) =>
                setFilters({ ...filters, showArchived: checked === true })
              }
            />
            <Label htmlFor="showArchived" className="cursor-pointer">
              Показывать архивные
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleReset}>
            Сбросить
          </Button>
          <Button onClick={handleApply}>Применить</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
