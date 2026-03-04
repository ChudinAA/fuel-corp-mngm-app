import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Plus,
  TrendingUp,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);

  const formatRate = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    }).format(value);

  const balance = parseFloat(card.currentBalance || "0");
  const isNegative = balance < 0;

  const counterpartyName =
    cardType === "buyer"
      ? card.buyer?.name || card.buyerName
      : card.supplier?.name || card.supplierName;

  const counterpartyLabel = cardType === "buyer" ? "Покупатель" : "Поставщик";
  const depositLabel = cardType === "buyer" ? "Пополнить карту" : "Внести аванс";

  const isUnlinked =
    cardType === "buyer"
      ? !card.buyerId && !card.buyer
      : !card.supplierId && !card.supplier;

  const weightedRate = parseFloat(card.weightedAverageRate || "0");
  const localBalance = weightedRate > 0 ? balance * weightedRate : null;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/storage-cards/${card.id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
      toast({ title: "Карта удалена" });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card
        className="hover-elevate cursor-pointer"
        onClick={() => onViewDetails(card)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
          <CardTitle className="text-base font-bold truncate">{card.name}</CardTitle>
          <CreditCard className="h-4 w-4 text-sky-400 shrink-0" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">{counterpartyLabel}</p>
              {isUnlinked ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    Не привязана к {cardType === "buyer" ? "Покупателю" : "Поставщику"}
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium truncate">{counterpartyName}</p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Остаток на карте</p>
              <p
                className={`text-2xl font-bold ${isNegative ? "text-red-600 dark:text-red-400" : ""}`}
              >
                {formatNumber(balance)} {card.currencySymbol || "$"}
              </p>
              {cardType === "buyer" && localBalance !== null && card.localCurrencyCode && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  ≈ {formatNumber(localBalance)} {card.localCurrencyCode}
                </p>
              )}
              {isNegative && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  Баланс отрицательный
                </Badge>
              )}
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
                      ? new Date(card.latestPrice.dateTo).toLocaleDateString("ru-RU")
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

            {cardType === "buyer" && weightedRate > 0 && (
              <div className="flex items-start gap-1.5">
                <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Средневзв. курс к USD
                  </p>
                  <p className="text-sm font-semibold">
                    {formatRate(weightedRate)}{" "}
                    {card.localCurrencyCode || "ед."} / USD
                  </p>
                </div>
              </div>
            )}

            {hasPermission("storage-cards", "edit") && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1"
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
                {isUnlinked && hasPermission("storage-cards", "delete") && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialogOpen(true);
                    }}
                    data-testid={`button-delete-${card.id}`}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить карту?</AlertDialogTitle>
            <AlertDialogDescription>
              Карта <strong>"{card.name}"</strong> не привязана ни к одному
              контрагенту. Вы уверены, что хотите её удалить? Это действие
              необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteDialogOpen(false);
                deleteMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
