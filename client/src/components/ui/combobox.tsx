import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  render?: React.ReactNode
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  dataTestId?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Выберите вариант...",
  emptyMessage = "Ничего не найдено.",
  className,
  dataTestId,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal min-w-0", className)}
          data-testid={dataTestId}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 text-left min-w-0">
            {selectedOption ? (
              <span className="truncate">
                {selectedOption.render || selectedOption.label}
              </span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command className="flex flex-col max-h-[300px]">
          <CommandInput placeholder="Поиск..." />
          <CommandList className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    const newValue = option.value === value ? "" : option.value;
                    onValueChange(newValue)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-1">
                    {option.render || option.label}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
