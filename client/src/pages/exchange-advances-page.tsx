import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Search } from "lucide-react";
import { ExchangeAdvanceCard } from "./exchange-advances/components/exchange-advance-card";
import { AuditPanel } from "@/components/audit-panel";

export default function ExchangeAdvancesPage() {
  const [search, setSearch] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);

  const { data: cards = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/exchange-advances"],
  });

  const filtered = cards.filter((card) => {
    if (!search) return true;
    return (card.sellerName || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Авансы Биржи</h1>
          <p className="text-muted-foreground">Авансы продавцов по биржевым сделкам</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setAuditOpen(true)}
          data-testid="button-audit-advances"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по продавцу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-advances"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 p-4 border rounded-md">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <p>Карты авансов будут созданы автоматически при добавлении сделок с продавцом.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => (
            <ExchangeAdvanceCard key={card.id} card={card} />
          ))}
        </div>
      )}

      <AuditPanel
        open={auditOpen}
        onOpenChange={setAuditOpen}
        entityType="exchange_advance_cards"
        entityId=""
        entityName="Все авансы Биржи"
      />
    </div>
  );
}
