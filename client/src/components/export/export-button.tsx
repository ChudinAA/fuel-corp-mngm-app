
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ExportDialog } from "./export-dialog";

export interface ExportFilters {
  search?: string;
  columnFilters?: Record<string, string[]>;
}

interface ExportButtonProps {
  moduleName: string;
  exportFilters?: ExportFilters;
  previewData?: any[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({
  moduleName,
  exportFilters,
  previewData,
  variant = "outline",
  size = "default",
}: ExportButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        data-testid="button-export-excel"
      >
        <Download className="h-4 w-4 mr-2" />
        Экспорт в Excel
      </Button>

      <ExportDialog
        moduleName={moduleName}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        exportFilters={exportFilters}
        previewData={previewData}
      />
    </>
  );
}
