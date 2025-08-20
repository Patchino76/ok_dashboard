"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface TrainingControlsProps {
  selectedMill: number
  onMillChange: (mill: number) => void
  startDate: Date | undefined
  onStartDateChange: (date: Date | undefined) => void
  endDate: Date | undefined
  onEndDateChange: (date: Date | undefined) => void
}

export function TrainingControls({
  selectedMill,
  onMillChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: TrainingControlsProps) {
  const mills = [6, 7, 8]
  const today = new Date()
  const defaultStartDate = new Date()
  defaultStartDate.setDate(today.getDate() - 30) // Default to 30 days ago

  // Format date to YYYY-MM-DD for input[type="date"]
  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Parse date from input value
  const parseDateFromInput = (value: string): Date | undefined => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  };

  return (
    <Card className="mb-6 border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mill Selection */}
          <div className="space-y-2">
            <Label htmlFor="mill-select" className="text-sm font-medium">
              Мелница
            </Label>
            <Select
              value={selectedMill.toString()}
              onValueChange={(value) => onMillChange(parseInt(value))}
            >
              <SelectTrigger id="mill-select" className="w-full">
                <SelectValue placeholder="Изберете мелница" />
              </SelectTrigger>
              <SelectContent>
                {mills.map((mill) => (
                  <SelectItem key={mill} value={mill.toString()}>
                    Мелница {mill}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="start-date" className="text-sm font-medium">
              Начална дата
            </Label>
            <Input
              id="start-date"
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => onStartDateChange(parseDateFromInput(e.target.value))}
              className="w-full"
            />
          </div>

          {/* End Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="end-date" className="text-sm font-medium">
              Крайна дата
            </Label>
            <Input
              id="end-date"
              type="date"
              value={formatDateForInput(endDate)}
              onChange={(e) => onEndDateChange(parseDateFromInput(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
