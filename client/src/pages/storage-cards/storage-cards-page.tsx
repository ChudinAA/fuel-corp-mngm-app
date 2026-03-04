import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History } from "lucide-react";
import { AdvanceCardsTab } from "./components/advance-cards-tab";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";

export default function StorageCardsPage({
  hideHeader = false,
}: {
  hideHeader?: boolean;
}) {
  const { hasPermission } = useAuth();
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Авансы</h1>
            <p className="text-muted-foreground">
              Управление авансами на зарубежных аэропортах
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setAuditPanelOpen(true)}
              title="История изменений"
            >
              <History className="h-4 w-4 mr-2" />
              История изменений
            </Button>
            <ExportButton moduleName="storage-cards" />
          </div>
        </div>
      )}

      <Tabs defaultValue="supplier">
        <TabsList>
          <TabsTrigger value="supplier" data-testid="tab-supplier-advances">
            Авансы поставщикам
          </TabsTrigger>
          <TabsTrigger value="buyer" data-testid="tab-buyer-advances">
            Авансы покупателей
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplier" className="mt-4">
          <AdvanceCardsTab cardType="supplier" />
        </TabsContent>

        <TabsContent value="buyer" className="mt-4">
          <AdvanceCardsTab cardType="buyer" />
        </TabsContent>
      </Tabs>

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
