import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Plus, Wallet } from "lucide-react";
import { StorageCardForm } from "./storage-card-form";
import { DepositForm } from "./deposit-form";
import { StorageCardItem } from "./storage-card-item";
import { StorageCardDetailsDialog } from "./storage-card-details-dialog";
import { queryClient } from "@/lib/queryClient";

interface AdvanceCardsTabProps {
  cardType: "supplier" | "buyer";
}

export function AdvanceCardsTab({ cardType }: AdvanceCardsTabProps) {
  const { hasPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [viewingCard, setViewingCard] = useState<any | null>(null);
  const [depositCard, setDepositCard] = useState<any | null>(null);

  const queryKey = ["/api/storage-cards/advances", cardType];

  const { data: storageCards, isLoading } = useQuery<any[]>({
    queryKey,
    queryFn: () =>
      fetch(`/api/storage-cards/advances?cardType=${cardType}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const filteredCards = storageCards
    ?.filter((card) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return card.name.toLowerCase().includes(query);
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const handleEdit = (card: any) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCard(null);
  };

  const depositTitle =
    cardType === "buyer" ? "Пополнение карты Покупателя" : "Внесение аванса";
  const emptyMessage =
    cardType === "buyer"
      ? "Карты покупателей не найдены"
      : "Карты поставщиков не найдены";
  const createLabel =
    cardType === "buyer" ? "Добавить карту покупателя" : "Добавить карту";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid={`input-search-${cardType}`}
          />
        </div>
        {hasPermission("storage-cards", "create") && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid={`button-add-card-${cardType}`}>
                <Plus className="h-4 w-4 mr-2" />
                {createLabel}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCard ? "Редактировать карту" : createLabel}
                </DialogTitle>
              </DialogHeader>
              <StorageCardForm
                editCard={editingCard}
                cardType={cardType}
                onSuccess={() => {
                  handleDialogClose();
                  queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
                }}
                onCancel={handleDialogClose}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !filteredCards?.length ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => (
            <StorageCardItem
              key={card.id}
              card={card}
              cardType={cardType}
              onEdit={handleEdit}
              onDeposit={(card) => setDepositCard(card)}
              onViewDetails={(card) => setViewingCard(card)}
            />
          ))}
        </div>
      )}

      {viewingCard && (
        <StorageCardDetailsDialog
          card={viewingCard}
          open={!!viewingCard}
          onOpenChange={(open) => !open && setViewingCard(null)}
        />
      )}

      <Dialog
        open={!!depositCard}
        onOpenChange={(open) => !open && setDepositCard(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {depositTitle}: {depositCard?.name}
            </DialogTitle>
          </DialogHeader>
          {depositCard && (
            <DepositForm
              card={depositCard}
              cardType={cardType}
              onSuccess={() => {
                setDepositCard(null);
                queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
              }}
              onCancel={() => setDepositCard(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
