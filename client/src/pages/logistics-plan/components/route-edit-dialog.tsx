import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const formSchema = z.object({
  transitDays: z.coerce.number().int().min(0).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface RouteEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: any;
  onSave: (id: string, data: any) => void;
  isPending: boolean;
}

export function RouteEditDialog({
  open,
  onOpenChange,
  route,
  onSave,
  isPending,
}: RouteEditDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transitDays: route?.transitDays ?? null,
      priority: route?.priority ?? null,
    },
  });

  useEffect(() => {
    if (open && route) {
      form.reset({
        transitDays: route.transitDays ?? null,
        priority: route.priority ?? null,
      });
    }
  }, [open, route]);

  const onSubmit = (data: FormData) => {
    const allIds = route.allRecords?.map((r: any) => r.id) || [route.id];
    allIds.forEach((id: string) => {
      onSave(id, {
        transitDays: data.transitDays ?? null,
        priority: data.priority ?? null,
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать маршрут</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 text-sm font-medium mb-4">
          <span>{route?.fromLocation}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{route?.toLocation}</span>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transitDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сутки пути</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        data-testid="input-transit-days"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Приоритет (1–5)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        placeholder="1–5"
                        data-testid="input-priority"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-route">
                {isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
