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
import { Wallet, Plus, TrendingUp, TrendingDown, History } from "lucide-react";
import { AuditPanel } from "@/components/audit-panel";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string;
  sellerName: string;
  type: "deposit" | "withdraw";
}

function TransactionDialog({ open, onOpenChange, cardId, sellerName, type }: TransactionDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === "deposit" ? "Пополнение аванса" : "Списание аванса"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Продавец: {sellerName}</p>
          <div className="space-y-1">
            <label className="text-sm font-medium">Сумма, руб</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              data-testid="input-transaction-amount"
            />
          </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!amount || mutation.isPending}
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
  const { toast } = useToast();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const balance = parseFloat(card.currentBalance || "0");
  const isNegative = balance < 0;

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ["/api/exchange-advances", card.id, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/exchange-advances/${card.id}/transactions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: historyOpen,
  });

  return (
    <>
      <Card data-testid={`card-advance-${card.id}`}>
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
              className={isNegative ? "text-destructive font-semibold text-lg" : "font-semibold text-lg"}
              data-testid={`balance-${card.id}`}
            >
              {formatMoney(balance)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              data-testid={`button-history-${card.id}`}
            >
              <History className="h-4 w-4 mr-1" />
              История
            </Button>
          </div>
        </CardContent>
      </Card>

      <TransactionDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        cardId={card.id}
        sellerName={card.sellerName || ""}
        type="deposit"
      />
      <TransactionDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        cardId={card.id}
        sellerName={card.sellerName || ""}
        type="withdraw"
      />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История транзакций — {card.sellerName}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Описание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Нет транзакций</TableCell>
                </TableRow>
              ) : (
                transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{formatDate(tx.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "deposit" ? "secondary" : "outline"}>
                        {tx.type === "deposit" ? "Пополнение" : "Списание"}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("text-right", tx.type === "withdraw" && "text-destructive")}>
                      {tx.type === "withdraw" ? "-" : ""}{formatMoney(tx.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{tx.description || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="pt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setHistoryOpen(false); setAuditOpen(true); }}>
              <History className="h-4 w-4 mr-1" />
              История аудита
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={auditOpen}
        onOpenChange={setAuditOpen}
        entityType="exchange_advances"
        entityId={card.id}
        entityName={`Аванс продавца ${card.sellerName}`}
      />
    </>
  );
}

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(" ");
}
