import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Maximize2 } from "lucide-react";
import type { Opt } from "@shared/schema";
import { AddOptDialog } from "./opt/components/add-opt-dialog";
import { OptTable } from "./opt/components/opt-table";
import { useAuth } from "@/hooks/use-auth";

export default function OptPage() {
  const [editingOpt, setEditingOpt] = useState<Opt | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingOpt(null);
    setIsCopy(false);
  };

  const handleOpenDialog = () => {
    setEditingOpt(null);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleEditOpt = (opt: Opt) => {
    setEditingOpt(opt);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  const handleCopyOpt = (opt: Opt) => {
    setEditingOpt(opt);
    setIsCopy(true);
    setIsDialogOpen(true);
  };

  const handleOptDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
    queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/opt/contract-used"] });
  };

  return (
    <div className="space-y-6">

      <AddOptDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        editOpt={editingOpt}
        isCopy={isCopy}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Список сделок ОПТ</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <OptTable
            onEdit={handleEditOpt}
            onCopy={handleCopyOpt}
            onDelete={handleOptDeleted}
            onAdd={handleOpenDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
