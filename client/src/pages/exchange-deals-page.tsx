import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Maximize2 } from "lucide-react";
import { ExchangeDealsTable } from "./exchange-deals/components/exchange-deals-table";
import { ExchangeDealsDialog } from "./exchange-deals/components/exchange-deals-dialog";
import { AuditPanel } from "@/components/audit-panel";
import { useAuth } from "@/hooks/use-auth";

export default function ExchangeDealsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingDeal(null);
    setIsCopy(false);
  };

  const handleAddNew = () => {
    setEditingDeal(null);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (deal: any) => {
    setEditingDeal(deal);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleCopy = (deal: any) => {
    setEditingDeal(deal);
    setIsCopy(true);
    setIsDialogOpen(true);
  };

  const handleDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/exchange-deals"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Сделки Биржи</h1>
          <p className="text-muted-foreground">Учёт биржевых сделок по ж/д перевозкам</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAuditOpen(true)}
            data-testid="button-audit-history"
          >
            <History className="h-4 w-4 mr-2" />
            История изменений
          </Button>
        </div>
      </div>

      <ExchangeDealsDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        deal={editingDeal}
        isCopy={isCopy}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 flex-wrap">
          <CardTitle>Список сделок</CardTitle>
          <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-fullscreen">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[98vw] h-[95vh]">
              <DialogHeader>
                <DialogTitle>Все сделки Биржи</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <ExchangeDealsTable
                  onEdit={handleEdit}
                  onCopy={handleCopy}
                  onDelete={handleDeleted}
                />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <ExchangeDealsTable
            onEdit={handleEdit}
            onCopy={handleCopy}
            onDelete={handleDeleted}
            onAdd={handleAddNew}
          />
        </CardContent>
      </Card>

      <AuditPanel
        open={auditOpen}
        onOpenChange={setAuditOpen}
        entityType="exchange_deals"
        entityId=""
        entityName="Все сделки Биржи (включая удалённые)"
      />
    </div>
  );
}
