import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface StorageCardItemProps {
  card: any;
  cardType?: "supplier" | "buyer";
  onEdit: (card: any) => void;
  onDeposit: (card: any) => void;
  onViewDetails: (card: any) => void;
}

export function StorageCardItem({
  card,
  cardType = "supplier",
  onEdit,
  onDeposit,
  onViewDetails,
}: StorageCardItemProps) {
  const { hasPermission } = useAuth();
  const formatNumber = (value: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

  const formatRate = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    }).format(value);

  const counterpartyName =
    cardType === "buyer"
      ? card.buyer?.name || card.buyerName || "—"
      : card.supplier?.name || card.supplierName || "—";

  const counterpartyLabel = cardType === "buyer" ? "Покупатель" : "Поставщик";

  const depositLabel =
    cardType === "buyer" ? "Пополнить карту" : "Внести аванс";

  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={() => onViewDetails(card)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
        <CardTitle className="text-base font-bold">{card.name}</CardTitle>
        <CreditCard className="h-4 w-4 text-sky-400 shrink-0" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">{counterpartyLabel}</p>
            <p className="text-sm font-medium truncate">{counterpartyName}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Остаток на карте</p>
            <p className="text-2xl font-bold">
              {formatNumber(parseFloat(card.currentBalance || "0"))}{" "}
              {card.currencySymbol}
            </p>
          </div>

          {cardType === "supplier" && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Цена за кг</p>
                <p
                  className={
                    card.latestPrice?.isExpired
                      ? "text-orange-600 font-bold"
                      : "font-medium"
                  }
                >
                  {card.latestPrice
                    ? `${card.latestPrice.price} ${card.currencySymbol}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Актуальна до</p>
                <p
                  className={
                    card.latestPrice?.isExpired
                      ? "text-orange-600 font-bold"
                      : "font-medium"
                  }
                >
                  {card.latestPrice
                    ? new Date(card.latestPrice.dateTo).toLocaleDateString(
                        "ru-RU",
                      )
                    : "—"}
                </p>
              </div>
            </div>
          )}

          {cardType === "supplier" && (
            <div>
              <p className="text-sm text-muted-foreground">Рассчитано кг</p>
              <p className="text-lg font-semibold text-primary">
                {formatNumber(card.kgAmount)} кг
              </p>
            </div>
          )}

          {cardType === "buyer" && parseFloat(card.weightedAverageRate || "0") > 0 && (
            <div className="flex items-start gap-1.5">
              <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Средневзв. курс к {card.currency || "USD"}
                </p>
                <p className="text-sm font-semibold">
                  {formatRate(parseFloat(card.weightedAverageRate || "0"))}{" "}
                  {card.currency || "USD"} / ед.
                </p>
              </div>
            </div>
          )}

          {hasPermission("storage-cards", "edit") && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeposit(card);
                }}
                data-testid={`button-deposit-${card.id}`}
              >
                <Plus className="h-4 w-4 mr-1" />
                {depositLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card);
                }}
                data-testid={`button-edit-${card.id}`}
              >
                Изм.
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
