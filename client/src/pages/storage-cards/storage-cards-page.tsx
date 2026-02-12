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
import { Search, Plus, History, Wallet } from "lucide-react";
import { StorageCardForm } from "./components/storage-card-form";
import { DepositForm } from "./components/deposit-form";
import { StorageCardItem } from "./components/storage-card-item";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";
import { queryClient } from "@/lib/queryClient";

export default function StorageCardsPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const { hasPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [depositCard, setDepositCard] = useState<any | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

  const { data: storageCards, isLoading } = useQuery<any[]>({
    queryKey: ["/api/storage-cards/advances"],
  });

  const filteredCards = storageCards?.filter((card) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.name.toLowerCase().includes(query) ||
      card.country.toLowerCase().includes(query) ||
      card.airport.toLowerCase().includes(query) ||
      card.airportCode?.toLowerCase().includes(query)
    );
  });

  const handleEdit = (card: any) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCard(null);
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Авансы поставщикам</h1>
            <p className="text-muted-foreground">
              Управление авансами на зарубежных аэропортах
            </p>
          </div>
          {hasPermission("storage-cards", "create") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-card">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить карту
                 </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingCard ? "Редактировать карту" : "Новая карта хранения"}
                  </DialogTitle>
                </DialogHeader>
                <StorageCardForm
                  editCard={editingCard}
                  onSuccess={handleDialogClose}
                  onCancel={handleDialogClose}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {hideHeader && hasPermission("storage-cards", "create") && (
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Карты хранения</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-card">
                <Plus className="h-4 w-4 mr-2" />
                Добавить карту
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCard ? "Редактировать карту" : "Новая карта хранения"}
                </DialogTitle>
              </DialogHeader>
              <StorageCardForm
                editCard={editingCard}
                onSuccess={handleDialogClose}
                onCancel={handleDialogClose}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию, стране, аэропорту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setAuditPanelOpen(true)}
          title="Аудит всех складов"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
        <ExportButton moduleName="storage-cards" />
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
            Карты хранения не найдены
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => (
            <StorageCardItem
              key={card.id}
              card={card}
              onEdit={handleEdit}
              onDeposit={(card) => setDepositCard(card)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!depositCard} onOpenChange={(open) => !open && setDepositCard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Внесение аванса: {depositCard?.name}
            </DialogTitle>
          </DialogHeader>
          {depositCard && (
            <DepositForm 
              card={depositCard} 
              onSuccess={() => {
                setDepositCard(null);
                queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
              }}
              onCancel={() => setDepositCard(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="storage_cards"
        entityId=""
        entityName="Все Карты хранения (включая удаленные)"
      />
    </div>
  );
}
