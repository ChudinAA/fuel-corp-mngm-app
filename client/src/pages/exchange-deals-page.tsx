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
    <div className="space-y-4">

      <ExchangeDealsDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        deal={editingDeal}
        isCopy={isCopy}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 flex-wrap">
          <CardTitle>Список сделок Биржи</CardTitle>
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
    </div>
  );
}
