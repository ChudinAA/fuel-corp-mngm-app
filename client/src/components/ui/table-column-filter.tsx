import * as React from "react"
import { Check, Filter, Search, X } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

interface TableColumnFilterProps {
  title: string
  options: { label: string; value: string }[]
  selectedValues: string[]
  onUpdate: (values: string[]) => void
  dataTestId?: string
}

export function TableColumnFilter({
  title,
  options,
  selectedValues,
  onUpdate,
  dataTestId,
}: TableColumnFilterProps) {
  const [open, setOpen] = React.useState(false)
  const [tempSelected, setTempSelected] = React.useState<string[]>(selectedValues)

  React.useEffect(() => {
    setTempSelected(selectedValues)
  }, [selectedValues, open])

  const handleToggle = (value: string) => {
    setTempSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    )
  }

  const handleSelectAll = () => {
    setTempSelected(options.map((o) => o.value))
  }

  const handleClear = () => {
    setTempSelected([])
  }

  const handleApply = () => {
    onUpdate(tempSelected)
    setOpen(false)
  }

  const isActive = selectedValues.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 hover:bg-muted",
            isActive && "text-primary bg-primary/10"
          )}
          data-testid={dataTestId}
        >
          <Filter className={cn("h-3.5 w-3.5", isActive && "fill-current")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <div className="p-2 font-medium text-xs text-muted-foreground bg-muted/50">
          Фильтр: {title}
        </div>
        <Command>
          <CommandInput placeholder="Поиск..." className="h-8" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Ничего не найдено.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => handleToggle(option.value)}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                >
                  <Checkbox
                    checked={tempSelected.includes(option.value)}
                    onCheckedChange={() => handleToggle(option.value)}
                  />
                  <span className="truncate text-sm">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <Separator />
        <div className="p-2 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px]"
              onClick={handleSelectAll}
            >
              Все
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px]"
              onClick={handleClear}
            >
              Сброс
            </Button>
          </div>
          <Button
            size="sm"
            className="h-7 px-3 text-[10px]"
            onClick={handleApply}
          >
            ОК
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
