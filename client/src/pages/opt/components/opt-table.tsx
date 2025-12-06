import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Pencil, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter
} from "lucide-react";
import { formatNumberForTable, formatCurrencyForTable } from "../utils";
import { useOptTable } from "../hooks/use-opt-table";

export function OptTable() {
  const {
    page,
    setPage,
    search,
    setSearch,
    editingOpt,
    setEditingOpt,
    pageSize,
    optDeals,
    isLoading,
    deleteMutation,
    handleDelete,
  } = useOptTable();

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const deals = optDeals?.data || [];
  const total = optDeals?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по сделкам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-opt"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Поставщик</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead className="text-right">КГ</TableHead>
              <TableHead className="text-right">Покупка</TableHead>
              <TableHead className="text-right">Продажа</TableHead>
              <TableHead className="text-right">Прибыль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>{formatDate(deal.dealDate)}</TableCell>
                  <TableCell>{deal.supplierId}</TableCell>
                  <TableCell>{deal.buyerId}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumberForTable(deal.quantityKg)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyForTable(deal.purchaseAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyForTable(deal.saleAmount)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrencyForTable(deal.profit)}</TableCell>
                  <TableCell>
                    {deal.warehouseStatus === "OK" ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        ОК
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Внимание
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setEditingOpt(deal)}
                        data-testid={`button-edit-opt-${deal.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(deal.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} из {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}