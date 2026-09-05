import * as React from "react"
import { Filter, Loader2 } from "lucide-react"
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
  /**
   * Если задан — при вводе текста в поиске вызывается этот callback
   * и результаты объединяются с уже имеющимися options.
   * Позволяет искать значения на бэкенде (не только по видимым строкам).
   */
  onSearch?: (query: string) => Promise<{ label: string; value: string }[]>
}

const MONTH_NAMES_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]

function parseDMY(s: string): Date | null {
  const parts = s.split(".")
  if (parts.length !== 3) return null
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null
  return new Date(y, m, d)
}

/** Проверяет, является ли значение спецмаркером */
function isSpecialValue(v: string) {
  return v.startsWith("__range__:") || v.startsWith("__month__:")
}

/** Форматирует ISO дату YYYY-MM-DD → DD.MM.YYYY для отображения */
function fmtIso(s: string) {
  const [y, m, d] = s.split("-")
  return d && m && y ? `${d}.${m}.${y}` : s
}

export function TableColumnFilter({
  title,
  options,
  selectedValues,
  onUpdate,
  dataTestId,
  isDateFilter,
  onSearch,
}: TableColumnFilterProps) {
  const [open, setOpen] = React.useState(false)
  const [tempSelected, setTempSelected] = React.useState<string[]>(selectedValues)
  const [rangeFrom, setRangeFrom] = React.useState("")
  const [rangeTo, setRangeTo] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<{ label: string; value: string }[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    setTempSelected(selectedValues)
    if (!open) {
      setRangeFrom("")
      setRangeTo("")
      setSearchQuery("")
      setSearchResults([])
    }
  }, [selectedValues, open])

  // Дебаунс поиска на бэкенде
  React.useEffect(() => {
    if (!onSearch) return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(searchQuery)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, onSearch])

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

  // --- Месяцы из опций ---
  const monthGroupsFromOptions = React.useMemo(() => {
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
    return groups
  }, [options, isDateFilter])

  // --- Последние 4 месяца (всегда показываем) ---
  const last4Months = React.useMemo(() => {
    if (!isDateFilter) return []
    const result: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const y = String(d.getFullYear())
      result.push({ key: `${y}-${m}`, label: `${MONTH_NAMES_RU[d.getMonth()]} ${y}` })
    }
    return result
  }, [isDateFilter])

  // --- Объединяем: последние 4 + из опций, дедупликация, сортировка по убыванию ---
  const allMonthGroups = React.useMemo(() => {
    const map = new Map<string, { key: string; label: string; values: string[] }>()
    last4Months.forEach((m) => {
      if (!map.has(m.key)) {
        map.set(m.key, { ...m, values: monthGroupsFromOptions.get(m.key)?.values ?? [] })
      }
    })
    monthGroupsFromOptions.forEach((group, key) => {
      if (!map.has(key)) {
        map.set(key, { key, label: group.label, values: group.values })
      } else {
        const existing = map.get(key)!
        if (!existing.values.length) existing.values = group.values
      }
    })
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [last4Months, monthGroupsFromOptions])

  /** Проверяет, выбран ли месяц — либо через маркер, либо через значения */
  const isMonthSelected = (group: { key: string; values: string[] }) => {
    const marker = `__month__:${group.key}`
    if (tempSelected.includes(marker)) return "full"
    if (group.values.length > 0) {
      const allSel = group.values.every((v) => tempSelected.includes(v))
      const someSel = group.values.some((v) => tempSelected.includes(v))
      if (allSel) return "full"
      if (someSel) return "partial"
    }
    return "none"
  }

  const handleMonthToggle = (group: { key: string; values: string[] }) => {
    const marker = `__month__:${group.key}`
    const state = isMonthSelected(group)

    if (group.values.length > 0) {
      if (state === "full") {
        setTempSelected((prev) => prev.filter((v) => !group.values.includes(v) && v !== marker))
      } else {
        setTempSelected((prev) => [...new Set([...prev.filter((v) => v !== marker), ...group.values])])
      }
    } else {
      if (state === "full") {
        setTempSelected((prev) => prev.filter((v) => v !== marker))
      } else {
        setTempSelected((prev) => [...prev.filter((v) => v !== marker), marker])
      }
    }
  }

  /** Применить диапазон дат как спецмаркер (сервер обработает через dateFrom/dateTo) */
  const handleApplyRange = () => {
    if (!rangeFrom || !rangeTo) return
    const fromDate = new Date(rangeFrom)
    const toDate = new Date(rangeTo)
    if (fromDate > toDate) return

    const marker = `__range__:${rangeFrom}:${rangeTo}`
    setTempSelected((prev) => {
      const withoutRanges = prev.filter((v) => !v.startsWith("__range__:") && !v.startsWith("__month__:"))
      return [...withoutRanges, marker]
    })
    setRangeFrom("")
    setRangeTo("")
  }

  // --- Активный диапазон ---
  const activeRangeFromTemp = React.useMemo(() => {
    const r = tempSelected.find((v) => v.startsWith("__range__:"))
    if (!r) return null
    const rest = r.slice("__range__:".length)
    const sepIdx = rest.indexOf(":")
    if (sepIdx === -1) return null
    return { from: rest.slice(0, sepIdx), to: rest.slice(sepIdx + 1) }
  }, [tempSelected])

  const activeRange = React.useMemo(() => {
    const r = selectedValues.find((v) => v.startsWith("__range__:"))
    if (!r) return null
    const rest = r.slice("__range__:".length)
    const sepIdx = rest.indexOf(":")
    if (sepIdx === -1) return null
    return { from: rest.slice(0, sepIdx), to: rest.slice(sepIdx + 1) }
  }, [selectedValues])

  // Только не-спецзначения для отображения в CommandList
  const regularOptions = React.useMemo(() => {
    return options.filter((o) => !isSpecialValue(o.value))
  }, [options])

  // Объединяем options с результатами бэкенд-поиска (дедупликация по value)
  const mergedOptions = React.useMemo(() => {
    // Когда задан onSearch и есть активный запрос — показываем ТОЛЬКО результаты поиска
    if (onSearch && searchQuery.length >= 2) return searchResults
    if (!searchResults.length) return regularOptions
    const seen = new Set(regularOptions.map((o) => o.value))
    const extra = searchResults.filter((r) => !seen.has(r.value))
    return [...regularOptions, ...extra]
  }, [regularOptions, searchResults, onSearch, searchQuery])

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
      <PopoverContent className="w-[290px] p-0" align="start">
        <div className="p-2 font-medium text-xs text-muted-foreground bg-muted/50">
          Фильтр: {title}
        </div>

        {isDateFilter && (
          <>
            <div className="p-2 space-y-2">
              {/* Активный диапазон — показываем из tempSelected пока открыто */}
              {activeRangeFromTemp && (
                <div className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded px-2 py-1">
                  <span>📅 {fmtIso(activeRangeFromTemp.from)} — {fmtIso(activeRangeFromTemp.to)}</span>
                  <button
                    className="ml-auto hover:text-destructive"
                    onClick={() => setTempSelected((prev) => prev.filter((v) => !v.startsWith("__range__:")))}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Быстрый выбор по месяцу
              </div>
              <div className="flex flex-wrap gap-1">
                {allMonthGroups.map((group) => {
                  const state = isMonthSelected(group)
                  return (
                    <Button
                      key={group.key}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        state === "full" && "bg-primary/10 border-primary text-primary",
                        state === "partial" && "border-primary/50 text-primary/70"
                      )}
                      onClick={() => handleMonthToggle(group)}
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

        <Command shouldFilter={!onSearch}>
          <div className="relative">
            <CommandInput
              placeholder="Поиск..."
              className="h-8"
              value={onSearch ? searchQuery : undefined}
              onValueChange={onSearch ? setSearchQuery : undefined}
            />
            {isSearching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <CommandList className={cn(isDateFilter ? "max-h-[160px]" : "max-h-[300px]")}>
            <CommandEmpty>
              {isSearching ? "Поиск..." : "Ничего не найдено."}
            </CommandEmpty>
            <CommandGroup>
              {mergedOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
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
