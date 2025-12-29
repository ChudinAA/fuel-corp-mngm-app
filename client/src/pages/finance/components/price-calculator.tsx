
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calculator } from "lucide-react";

export function PriceCalculator() {
  const [productType, setProductType] = useState("kerosene");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [storageCost, setStorageCost] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [agentFee, setAgentFee] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [markupType, setMarkupType] = useState("percentage");
  const [markupValue, setMarkupValue] = useState(0);

  const totalCost = purchasePrice + deliveryCost + storageCost + serviceFee + agentFee + otherCosts;
  
  const sellingPrice = markupType === "percentage"
    ? totalCost * (1 + markupValue / 100)
    : totalCost + markupValue;

  const margin = sellingPrice - totalCost;
  const marginPercentage = totalCost > 0 ? (margin / totalCost) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const reset = () => {
    setPurchasePrice(0);
    setDeliveryCost(0);
    setStorageCost(0);
    setServiceFee(0);
    setAgentFee(0);
    setOtherCosts(0);
    setMarkupValue(0);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Калькулятор цены
          </CardTitle>
          <CardDescription>Введите компоненты себестоимости для расчета</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="calc-productType">Тип продукта</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger id="calc-productType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kerosene">Керосин</SelectItem>
                <SelectItem value="pvkj">ПВК-Ж</SelectItem>
                <SelectItem value="service">Услуга</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold">Компоненты себестоимости</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calc-purchase">Цена закупки</Label>
                <Input
                  id="calc-purchase"
                  type="number"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-delivery">Стоимость доставки</Label>
                <Input
                  id="calc-delivery"
                  type="number"
                  step="0.01"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-storage">Стоимость хранения</Label>
                <Input
                  id="calc-storage"
                  type="number"
                  step="0.01"
                  value={storageCost}
                  onChange={(e) => setStorageCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-service">Стоимость услуги</Label>
                <Input
                  id="calc-service"
                  type="number"
                  step="0.01"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-agent">Агентское вознаграждение</Label>
                <Input
                  id="calc-agent"
                  type="number"
                  step="0.01"
                  value={agentFee}
                  onChange={(e) => setAgentFee(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-other">Прочие расходы</Label>
                <Input
                  id="calc-other"
                  type="number"
                  step="0.01"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold">Наценка</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calc-markupType">Тип наценки</Label>
                <Select value={markupType} onValueChange={setMarkupType}>
                  <SelectTrigger id="calc-markupType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Процент</SelectItem>
                    <SelectItem value="fixed">Фиксированная сумма</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="calc-markup">
                  {markupType === "percentage" ? "Процент наценки" : "Сумма наценки"}
                </Label>
                <Input
                  id="calc-markup"
                  type="number"
                  step="0.01"
                  value={markupValue}
                  onChange={(e) => setMarkupValue(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <Button onClick={reset} variant="outline" className="w-full">
            Сбросить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Результат расчета</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Себестоимость:</span>
              <span className="font-medium">{formatCurrency(totalCost)}</span>
            </div>
            <Separator />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-semibold">Цена продажи:</span>
              <span className="font-bold text-lg text-primary">
                {formatCurrency(sellingPrice)}
              </span>
            </div>
            <Separator />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Маржа:</span>
              <span className="font-medium text-green-600">
                {formatCurrency(margin)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Маржа %:</span>
              <span className="font-medium text-green-600">
                {marginPercentage.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Детализация:</h4>
            {purchasePrice > 0 && (
              <div className="flex justify-between text-xs">
                <span>Закупка</span>
                <span>{formatCurrency(purchasePrice)}</span>
              </div>
            )}
            {deliveryCost > 0 && (
              <div className="flex justify-between text-xs">
                <span>Доставка</span>
                <span>{formatCurrency(deliveryCost)}</span>
              </div>
            )}
            {storageCost > 0 && (
              <div className="flex justify-between text-xs">
                <span>Хранение</span>
                <span>{formatCurrency(storageCost)}</span>
              </div>
            )}
            {serviceFee > 0 && (
              <div className="flex justify-between text-xs">
                <span>Услуги</span>
                <span>{formatCurrency(serviceFee)}</span>
              </div>
            )}
            {agentFee > 0 && (
              <div className="flex justify-between text-xs">
                <span>Агентское</span>
                <span>{formatCurrency(agentFee)}</span>
              </div>
            )}
            {otherCosts > 0 && (
              <div className="flex justify-between text-xs">
                <span>Прочее</span>
                <span>{formatCurrency(otherCosts)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
