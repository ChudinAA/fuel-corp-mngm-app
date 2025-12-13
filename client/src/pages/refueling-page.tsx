import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { AircraftRefueling } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AddRefuelingDialog } from "./refueling/add-refueling-dialog";
import { RefuelingTable } from "./refueling/refueling-table";

export default function RefuelingPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingRefueling, setEditingRefueling] = useState<AircraftRefueling | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: allSuppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: allBases = [] } = useQuery<any[]>({
    queryKey: ["/api/bases?baseType=refueling"],
  });

  const { data: allBuyers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });

  // Filter suppliers that have refueling bases attached
  const refuelingBases = allBases.filter(b => b.baseType === 'refueling');
  const refuelingBaseIds = new Set(refuelingBases.map(b => b.id));

  const suppliers = allSuppliers.filter(s => 
    s.baseIds?.some((baseId: string) => refuelingBaseIds.has(baseId))
  );

  const buyers = allBuyers.filter(b => b.module === 'refueling' || b.module === 'both');

  const { data: refuelings, isLoading } = useQuery<{ data: AircraftRefueling[]; total: number }>({
    queryKey: ["/api/refueling", page, search],
  });

  const data = refuelings?.data || [];
  const total = refuelings?.total || 0;

  const handleEditClick = (refueling: AircraftRefueling) => {
    setEditingRefueling(refueling);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRefueling(null);
  };

  const handleOpenDialog = () => {
    setEditingRefueling(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Заправка ВС</h1>
          <p className="text-muted-foreground">
            Учет заправок воздушных судов и сопутствующих услуг
          </p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="button-add-refueling">
          <Plus className="mr-2 h-4 w-4" />
          Новая заправка
        </Button>
      </div>

      <AddRefuelingDialog
        suppliers={suppliers || []}
        buyers={buyers || []}
        editRefueling={editingRefueling}
        open={isDialogOpen}
        onOpenChange={(open) => !open && handleCloseDialog()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список заправок</CardTitle>
          <CardDescription>История заправок воздушных судов</CardDescription>
        </CardHeader>
        <CardContent>
          <RefuelingTable
            data={data}
            total={total}
            page={page}
            search={search}
            isLoading={isLoading}
            onPageChange={setPage}
            onSearchChange={setSearch}
            onEdit={handleEditClick}
          />
        </CardContent>
      </Card>
    </div>
  );
}