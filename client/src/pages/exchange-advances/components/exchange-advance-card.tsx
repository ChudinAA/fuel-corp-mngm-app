import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

function formatMoney(val: string | number | null | undefined) {
  const num = parseFloat(String(val || "0"));
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return format(new Date(val), "dd.MM.yyyy HH:mm", { locale: ru });
  } catch {
    return val;
  }
}

function getTxTypeLabel(tx: any): string {
  if (tx.transactionType === "income") return "Пополнение";
  if (tx.transactionType === "expense" && tx.relatedDealId) return "Списание по сделке";
  return "Списание вручную";
}

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string;
  sellerName: string;
  type: "deposit" | "withdraw";
  currentBalance: number;
}

function TransactionDialog({
  open,
  onOpenChange,
  cardId,
  sellerName,
  type,
  currentBalance,
}: TransactionDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const amountNum = parseFloat(amount || "0");
  const isOverdraft = type === "withdraw" && amountNum > 0 && amountNum > currentBalance;

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/exchange-advances/${cardId}/transactions`, {
        transactionType: type === "deposit" ? "income" : "expense",
        amount,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-advances"] });
      toast({ title: type === "deposit" ? "Аванс пополнен" : "Списание выполнено" });
      setAmount("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setAmount("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === "deposit" ? "Пополнение аванса" : "Списание аванса"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Продавец: {sellerName}</p>
          {type === "withdraw" && (
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted">
              <span className="text-sm text-muted-foreground">Остаток на карте:</span>
              <span className="text-sm font-semibold">{formatMoney(currentBalance)}</span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">Сумма, руб</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              data-testid="input-transaction-amount"
              className={isOverdraft ? "border-destructive" : ""}
            />
          </div>
          {isOverdraft && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                Сумма превышает остаток ({formatMoney(currentBalance)}). Операция недоступна.
              </span>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">Описание</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Комментарий к операции"
              data-testid="input-transaction-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!amount || mutation.isPending || isOverdraft}
            data-testid="button-confirm-transaction"
          >
            {mutation.isPending ? "Сохранение..." : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExchangeAdvanceCardProps {
  card: any;
}

export function ExchangeAdvanceCard({ card }: ExchangeAdvanceCardProps) {
  const { hasPermission } = useAuth();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const balance = parseFloat(card.currentBalance || "0");
  const isNegative = balance < 0;

  const { data: transactions = [], isLoading: txLoading } = useQuery<any[]>({
    queryKey: ["/api/exchange-advances", card.id, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/exchange-advances/${card.id}/transactions`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: historyOpen,
  });

  return (
    <>
      <Card
        data-testid={`card-advance-${card.id}`}
        className="hover-elevate cursor-pointer"
        onClick={() => setHistoryOpen(true)}
      >
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4 space-y-0 flex-wrap">
          <div>
            <CardTitle className="text-base">{card.sellerName || "Продавец"}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Аванс биржи (руб)</p>
          </div>
          <Badge variant={isNegative ? "destructive" : "secondary"}>
            {isNegative ? "Дефицит" : "Активен"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <span
              className={cn(
                "font-semibold text-lg",
                isNegative && "text-destructive",
              )}
              data-testid={`balance-${card.id}`}
            >
              {formatMoney(balance)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {hasPermission("exchange-advances", "edit") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDepositOpen(true)}
                  data-testid={`button-deposit-${card.id}`}
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Пополнить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWithdrawOpen(true)}
                  data-testid={`button-withdraw-${card.id}`}
                >
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Списать
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <TransactionDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        cardId={card.id}
        sellerName={card.sellerName || ""}
        type="deposit"
        currentBalance={balance}
      />
      <TransactionDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        cardId={card.id}
        sellerName={card.sellerName || ""}
        type="withdraw"
        currentBalance={balance}
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>История транзакций — {card.sellerName}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted mb-2 shrink-0">
            <span className="text-sm text-muted-foreground">Текущий остаток:</span>
            <span className={cn("text-sm font-semibold", isNegative && "text-destructive")}>
              {formatMoney(balance)}
            </span>
          </div>
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Дата</TableHead>
                  <TableHead className="text-xs">Тип</TableHead>
                  <TableHead className="text-right text-xs">Сумма</TableHead>
                  <TableHead className="text-xs">Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                      Нет транзакций
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx: any) => {
                    const isIncome = tx.transactionType === "income";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{formatDate(tx.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={isIncome ? "secondary" : "outline"}>
                            {getTxTypeLabel(tx)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right text-sm",
                            !isIncome && "text-destructive",
                          )}
                        >
                          {!isIncome ? "-" : "+"}
                          {formatMoney(tx.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {tx.description || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
