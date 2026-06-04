import * as React from "react"
import { Filter } from "lucide-react"
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
  isDateFilter?: boolean
}

const MONTH_NAMES_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]

function parseDMY(s: string): Date | null {
  const parts = s.split(".")
  if (parts.length !== 3) return null
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null
  return new Date(y, m, d)
}

export function TableColumnFilter({
  title,
  options,
  selectedValues,
  onUpdate,
  dataTestId,
  isDateFilter,
}: TableColumnFilterProps) {
  const [open, setOpen] = React.useState(false)
  const [tempSelected, setTempSelected] = React.useState<string[]>(selectedValues)
  const [rangeFrom, setRangeFrom] = React.useState("")
  const [rangeTo, setRangeTo] = React.useState("")

  React.useEffect(() => {
    setTempSelected(selectedValues)
    if (!open) {
      setRangeFrom("")
      setRangeTo("")
    }
  }, [selectedValues, open])

  const handleToggle = (value: string) => {
    setTempSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handleSelectAll = () => setTempSelected(options.map((o) => o.value))
  const handleClear = () => setTempSelected([])

  const handleApply = () => {
    onUpdate(tempSelected)
    setOpen(false)
  }

  const monthGroups = React.useMemo(() => {
    if (!isDateFilter) return []
    const groups = new Map<string, { values: string[]; label: string }>()
    options.forEach((opt) => {
      const parts = opt.value.split(".")
      if (parts.length === 3) {
        const key = `${parts[2]}-${parts[1]}`
        if (!groups.has(key)) {
          const monthIdx = parseInt(parts[1]) - 1
          const label = `${MONTH_NAMES_RU[monthIdx] ?? parts[1]} ${parts[2]}`
          groups.set(key, { values: [], label })
        }
        groups.get(key)!.values.push(opt.value)
      }
    })
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, { values, label }]) => ({ key, values, label }))
  }, [options, isDateFilter])

  const handleMonthToggle = (values: string[]) => {
    const allSelected = values.every((v) => tempSelected.includes(v))
    if (allSelected) {
      setTempSelected((prev) => prev.filter((v) => !values.includes(v)))
    } else {
      setTempSelected((prev) => [...new Set([...prev, ...values])])
    }
  }

  const handleApplyRange = () => {
    if (!rangeFrom || !rangeTo) return
    const fromDate = new Date(rangeFrom)
    const toDate = new Date(rangeTo)
    if (fromDate > toDate) return
    const inRange = options
      .filter((opt) => {
        const d = parseDMY(opt.value)
        return d !== null && d >= fromDate && d <= toDate
      })
      .map((opt) => opt.value)
    setTempSelected((prev) => [...new Set([...prev, ...inRange])])
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
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 font-medium text-xs text-muted-foreground bg-muted/50">
          Фильтр: {title}
        </div>

        {isDateFilter && monthGroups.length > 0 && (
          <>
            <div className="p-2 space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Быстрый выбор по месяцу
              </div>
              <div className="flex flex-wrap gap-1">
                {monthGroups.map((group) => {
                  const allSel = group.values.every((v) => tempSelected.includes(v))
                  const someSel = !allSel && group.values.some((v) => tempSelected.includes(v))
                  return (
                    <Button
                      key={group.key}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        allSel && "bg-primary/10 border-primary text-primary",
                        someSel && "border-primary/50 text-primary/70"
                      )}
                      onClick={() => handleMonthToggle(group.values)}
                    >
                      {group.label}
                    </Button>
                  )
                })}
              </div>

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-1">
                Диапазон дат
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="flex-1 h-7 text-[11px] border rounded-md px-1.5 bg-background text-foreground border-input outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">—</span>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="flex-1 h-7 text-[11px] border rounded-md px-1.5 bg-background text-foreground border-input outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] shrink-0"
                  onClick={handleApplyRange}
                  disabled={!rangeFrom || !rangeTo}
                >
                  OK
                </Button>
              </div>
            </div>
            <Separator />
          </>
        )}

        <Command>
          <CommandInput placeholder="Поиск..." className="h-8" />
          <CommandList className={cn(isDateFilter ? "max-h-[200px]" : "max-h-[300px]")}>
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
