
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

interface PriceCalculation {
  id?: string;
  name: string;
  description: string | null;
  productType: string;
  purchasePrice: string;
  deliveryCost: string;
  storageCost: string;
  serviceFee: string;
  agentFee: string;
  otherCosts: string;
  markupType: string;
  markupValue: string;
  isTemplate: boolean;
}

interface PriceCalculationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculation?: any;
}

export function PriceCalculationDialog({ open, onOpenChange, calculation }: PriceCalculationDialogProps) {
  const { toast } = useToast();
  const [isTemplate, setIsTemplate] = useState(calculation?.isTemplate || false);

  const { register, handleSubmit, watch, setValue } = useForm<PriceCalculation>({
    defaultValues: calculation || {
      name: "",
      description: null,
      productType: "kerosene",
      purchasePrice: "0",
      deliveryCost: "0",
      storageCost: "0",
      serviceFee: "0",
      agentFee: "0",
      otherCosts: "0",
      markupType: "percentage",
      markupValue: "0",
      isTemplate: false,
    },
  });

  const productType = watch("productType");
  const markupType = watch("markupType");

  const createMutation = useMutation({
    mutationFn: async (data: PriceCalculation) => {
      // Рассчитываем итоговые значения
      const totalCost = [
        data.purchasePrice,
        data.deliveryCost,
        data.storageCost,
        data.serviceFee,
        data.agentFee,
        data.otherCosts,
      ].reduce((sum, val) => sum + parseFloat(val || "0"), 0);

      let sellingPrice = totalCost;
      if (data.markupType === "percentage") {
        sellingPrice = totalCost * (1 + parseFloat(data.markupValue || "0") / 100);
      } else {
        sellingPrice = totalCost + parseFloat(data.markupValue || "0");
      }

      const margin = sellingPrice - totalCost;
      const marginPercentage = totalCost > 0 ? (margin / totalCost) * 100 : 0;

      const response = await fetch("/api/price-calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          isTemplate,
          totalCost: totalCost.toFixed(2),
          sellingPrice: sellingPrice.toFixed(2),
          margin: margin.toFixed(2),
          marginPercentage: marginPercentage.toFixed(2),
        }),
      });
      if (!response.ok) throw new Error("Ошибка при создании расчета");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-calculations"] });
      toast({
        title: "Успешно",
        description: "Расчет создан",
      });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PriceCalculation) => {
      const totalCost = [
        data.purchasePrice,
        data.deliveryCost,
        data.storageCost,
        data.serviceFee,
        data.agentFee,
        data.otherCosts,
      ].reduce((sum, val) => sum + parseFloat(val || "0"), 0);

      let sellingPrice = totalCost;
      if (data.markupType === "percentage") {
        sellingPrice = totalCost * (1 + parseFloat(data.markupValue || "0") / 100);
      } else {
        sellingPrice = totalCost + parseFloat(data.markupValue || "0");
      }

      const margin = sellingPrice - totalCost;
      const marginPercentage = totalCost > 0 ? (margin / totalCost) * 100 : 0;

      const response = await fetch(`/api/price-calculations/${calculation?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          isTemplate,
          totalCost: totalCost.toFixed(2),
          sellingPrice: sellingPrice.toFixed(2),
          margin: margin.toFixed(2),
          marginPercentage: marginPercentage.toFixed(2),
        }),
      });
      if (!response.ok) throw new Error("Ошибка при обновлении расчета");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-calculations"] });
      toast({
        title: "Успешно",
        description: "Расчет обновлен",
      });
      onOpenChange(false);
    },
  });

  const onSubmit = (data: PriceCalculation) => {
    if (calculation?.id) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {calculation?.id ? "Редактировать расчет" : "Создать расчет цены"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название расчета</Label>
              <Input
                id="name"
                {...register("name", { required: true })}
                placeholder="Например: Керосин ЯНОС + доставка"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productType">Тип продукта</Label>
              <Select
                value={productType}
                onValueChange={(value) => setValue("productType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kerosene">Керосин</SelectItem>
                  <SelectItem value="pvkj">ПВК-Ж</SelectItem>
                  <SelectItem value="service">Услуга</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" {...register("description")} />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Компоненты себестоимости</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Цена закупки</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  {...register("purchasePrice")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryCost">Стоимость доставки</Label>
                <Input
                  id="deliveryCost"
                  type="number"
                  step="0.01"
                  {...register("deliveryCost")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="storageCost">Стоимость хранения</Label>
                <Input
                  id="storageCost"
                  type="number"
                  step="0.01"
                  {...register("storageCost")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceFee">Стоимость услуги</Label>
                <Input
                  id="serviceFee"
                  type="number"
                  step="0.01"
                  {...register("serviceFee")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentFee">Агентское вознаграждение</Label>
                <Input
                  id="agentFee"
                  type="number"
                  step="0.01"
                  {...register("agentFee")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherCosts">Прочие расходы</Label>
                <Input
                  id="otherCosts"
                  type="number"
                  step="0.01"
                  {...register("otherCosts")}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Наценка</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="markupType">Тип наценки</Label>
                <Select
                  value={markupType}
                  onValueChange={(value) => setValue("markupType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Процент</SelectItem>
                    <SelectItem value="fixed">Фиксированная сумма</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="markupValue">
                  {markupType === "percentage" ? "Процент наценки" : "Сумма наценки"}
                </Label>
                <Input
                  id="markupValue"
                  type="number"
                  step="0.01"
                  {...register("markupValue")}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isTemplate"
              checked={isTemplate}
              onCheckedChange={setIsTemplate}
            />
            <Label htmlFor="isTemplate">Сохранить как шаблон</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">
              {calculation?.id ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
