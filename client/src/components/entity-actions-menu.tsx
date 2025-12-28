
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, History } from "lucide-react";
import { AuditPanel } from "@/components/audit-panel";
import { useAuth } from "@/hooks/use-auth";

export interface EntityAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "destructive";
  permission?: {
    module: string;
    action: string;
  };
  condition?: boolean; // дополнительное условие показа пункта
  separatorAfter?: boolean;
}

export interface EntityActionsMenuProps {
  actions: EntityAction[];
  // Опциональные параметры для аудита
  audit?: {
    entityType: string;
    entityId: string;
    entityName: string;
  };
  triggerClassName?: string;
  alignMenu?: "start" | "end" | "center";
}

export function EntityActionsMenu({
  actions,
  audit,
  triggerClassName,
  alignMenu = "end",
}: EntityActionsMenuProps) {
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { hasPermission } = useAuth();

  // Фильтруем действия по правам доступа и условиям
  const visibleActions = actions.filter((action) => {
    // Проверяем права доступа
    if (action.permission) {
      const hasAccess = hasPermission(action.permission.module, action.permission.action);
      if (!hasAccess) return false;
    }

    // Проверяем дополнительное условие
    if (action.condition !== undefined && !action.condition) {
      return false;
    }

    return true;
  });

  // Если нет видимых действий и нет аудита, не показываем меню
  if (visibleActions.length === 0 && !audit) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName || "h-8 w-8"}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={alignMenu}>
          {visibleActions.map((action, index) => {
            const Icon = action.icon;
            const isDestructive = action.variant === "destructive";
            const showSeparator = action.separatorAfter && index < visibleActions.length - 1;

            return (
              <div key={action.id}>
                <DropdownMenuItem
                  onClick={action.onClick}
                  className={isDestructive ? "text-destructive focus:text-destructive" : ""}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {action.label}
                </DropdownMenuItem>
                {showSeparator && <DropdownMenuSeparator />}
              </div>
            );
          })}

          {audit && visibleActions.length > 0 && <DropdownMenuSeparator />}

          {audit && (
            <DropdownMenuItem onClick={() => setAuditPanelOpen(true)}>
              <History className="h-4 w-4 mr-2" />
              История изменений
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {audit && (
        <AuditPanel
          open={auditPanelOpen}
          onOpenChange={setAuditPanelOpen}
          entityType={audit.entityType}
          entityId={audit.entityId}
          entityName={audit.entityName}
        />
      )}
    </>
  );
}
