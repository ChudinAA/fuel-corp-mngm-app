
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ExportDialog } from "./export-dialog";

interface ExportButtonProps {
  moduleName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({ moduleName, variant = "outline", size = "default" }: ExportButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={() => setIsDialogOpen(true)}
      >
        <Download className="h-4 w-4 mr-2" />
        Экспорт в Excel
      </Button>
      
      <ExportDialog
        moduleName={moduleName}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}
