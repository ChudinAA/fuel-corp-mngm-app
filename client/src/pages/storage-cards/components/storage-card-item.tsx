import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus } from "lucide-react";

interface StorageCardItemProps {
  card: any;
  onEdit: (card: any) => void;
  onDeposit: (card: any) => void;
}

export function StorageCardItem({ card, onEdit, onDeposit }: StorageCardItemProps) {
  const formatNumber = (value: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

  return (
    <Card className="hover-elevate">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
        <CardTitle className="text-base font-bold">{card.name}</CardTitle>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Остаток авансов</p>
            <p className="text-2xl font-bold">
              {formatNumber(parseFloat(card.currentBalance || "0"))} $
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Цена за кг</p>
              <p className={card.latestPrice?.isExpired ? "text-orange-600 font-bold" : "font-medium"}>
                {card.latestPrice ? `${card.latestPrice.price} $` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Актуальна до</p>
              <p className={card.latestPrice?.isExpired ? "text-orange-600 font-bold" : "font-medium"}>
                {card.latestPrice ? new Date(card.latestPrice.dateTo).toLocaleDateString("ru-RU") : "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Рассчитано кг</p>
            <p className="text-lg font-semibold text-primary">
              {formatNumber(card.kgAmount)} кг
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="w-full"
              onClick={() => onDeposit(card)}
              data-testid={`button-deposit-${card.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Внести аванс
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(card)}
              data-testid={`button-edit-${card.id}`}
            >
              Изм.
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
