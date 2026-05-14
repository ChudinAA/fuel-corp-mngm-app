import { useState, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value?: Date | null;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = "дд.мм.гггг",
  disabled,
  className,
  "data-testid": dataTestId,
}: DateInputProps) {
  const [textValue, setTextValue] = useState<string>(
    value && isValid(value) ? format(value, "dd.MM.yyyy") : "",
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value && isValid(value)) {
      setTextValue(format(value, "dd.MM.yyyy"));
    } else if (!value) {
      setTextValue("");
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d.]/g, "");

    // Auto-insert dots after day and month
    if (raw.length === 2 && !raw.includes(".") && textValue.length === 1) {
      raw = raw + ".";
    } else if (raw.length === 5 && raw.charAt(2) === "." && !raw.slice(3).includes(".") && textValue.length === 4) {
      raw = raw + ".";
    }

    setTextValue(raw);

    if (raw.length === 10) {
      const parsed = parse(raw, "dd.MM.yyyy", new Date());
      if (isValid(parsed)) {
        onChange(parsed);
      }
    } else if (raw === "") {
      onChange(undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    if (date && isValid(date)) {
      setTextValue(format(date, "dd.MM.yyyy"));
    } else {
      setTextValue("");
    }
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        value={textValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={dataTestId}
        maxLength={10}
        className="flex-1 min-w-0"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleCalendarSelect}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
