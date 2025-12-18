
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { UseFormReturn } from "react-hook-form";
import type { OptFormData } from "../schemas";

interface OptFormNotesSectionProps {
  form: UseFormReturn<OptFormData>;
}

export function OptFormNotesSection({ form }: OptFormNotesSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Примечания</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Дополнительная информация..."
                className="resize-none"
                data-testid="input-notes"
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="isApproxVolume"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0 pt-6">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="checkbox-approx-volume"
              />
            </FormControl>
            <FormLabel className="text-sm font-normal cursor-pointer">
              Примерный объем (требует уточнения)
            </FormLabel>
          </FormItem>
        )}
      />
    </div>
  );
}
