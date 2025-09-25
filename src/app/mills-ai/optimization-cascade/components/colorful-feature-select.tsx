"use client"

import { useState, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { CheckCircle2, ChevronDown, LucideIcon } from "lucide-react"
import type { VariableInfo } from "../../data/variable-classifier-helper"

interface ColorTheme {
  icon: string
  triggerBg: string
  triggerBorder: string
  triggerText: string
  dropdownBg: string
  dropdownBorder: string
  badge: string
  badgeText: string
}

interface ColorfulFeatureSelectProps {
  label: string
  placeholder: string
  selectedLabel: string
  options: VariableInfo[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  icon: LucideIcon
  colorTheme: ColorTheme
  disabled?: boolean
}

export function ColorfulFeatureSelect({
  label,
  placeholder,
  selectedLabel,
  options,
  selectedValues,
  onChange,
  icon: Icon,
  colorTheme,
  disabled = false
}: ColorfulFeatureSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const toggleValue = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter(value => value !== id))
    } else {
      onChange([...selectedValues, id])
    }
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorTheme.icon}`} />
        <Label className="text-base font-medium">{label}</Label>
        <Badge variant="secondary" className="text-xs">
          {selectedValues.length} selected
        </Badge>
      </div>
      <div className="relative">
        <button
          type="button"
          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${colorTheme.triggerBg} ${colorTheme.triggerBorder} ${colorTheme.triggerText}`}
          onClick={() => !disabled && setOpen(prev => !prev)}
          disabled={disabled}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedValues.map(value => {
                  const option = options.find(item => item.id === value)
                  if (!option) return null
                  return (
                    <Badge
                      key={value}
                      variant="secondary"
                      className={`flex items-center gap-1 ${colorTheme.badge} ${colorTheme.badgeText}`}
                    >
                      <Icon className="h-3 w-3" />
                      {option.name}
                    </Badge>
                  )
                })
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </div>
        </button>
        {open && (
          <div
            className={`absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border p-2 text-sm shadow-lg ${colorTheme.dropdownBg} ${colorTheme.dropdownBorder}`}
          >
            <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">
              {selectedLabel}
            </div>
            <div className="space-y-1">
              {options.map(option => {
                const isSelected = selectedValues.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-black/5 focus:outline-none"
                    onClick={() => toggleValue(option.id)}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <Icon className={`h-4 w-4 ${colorTheme.icon}`} />
                    <span className="flex-1">
                      {option.name} <span className="opacity-60">({option.unit})</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
