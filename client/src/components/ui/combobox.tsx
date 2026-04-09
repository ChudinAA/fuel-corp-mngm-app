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
  disabled?: boolean
  allowCustomValue?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Выберите вариант...",
  emptyMessage = "Ничего не найдено.",
  className,
  dataTestId,
  disabled = false,
  allowCustomValue = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)
  const displayValue = selectedOption ? selectedOption.label : (value || "")

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(option => 
      option.label.toLowerCase().includes(lowerSearch) || 
      option.value.toLowerCase().includes(lowerSearch)
    );
  }, [options, search]);

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal min-w-0", className)}
          data-testid={dataTestId}
          disabled={disabled}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 text-left min-w-0">
            {displayValue ? (
              <span className="truncate">
                {displayValue}
              </span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command className="flex flex-col" shouldFilter={false}>
          <CommandInput 
            placeholder="Поиск..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden scrollbar-thin">
            {filteredOptions.length === 0 && !allowCustomValue && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            {filteredOptions.length === 0 && allowCustomValue && !search && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    const newValue = option.value === value ? "" : option.value;
                    onValueChange(newValue)
                    setOpen(false)
                    setSearch("")
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
              {allowCustomValue && search && !filteredOptions.some(
                (o) => o.value.toLowerCase() === search.toLowerCase()
              ) && (
                <CommandItem
                  value={`__custom__${search}`}
                  onSelect={() => {
                    onValueChange(search);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground">Ввести:</span>
                  <span className="font-medium">{search}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
