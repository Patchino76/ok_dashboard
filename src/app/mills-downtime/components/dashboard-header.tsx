"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIME_RANGE_OPTIONS, type TimeRange } from "../lib/downtime-types";
import { RefreshCw, Settings } from "lucide-react";

interface DashboardHeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  downtimeThreshold: number;
  onThresholdChange: (value: number) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({
  timeRange,
  onTimeRangeChange,
  downtimeThreshold,
  onThresholdChange,
  onRefresh,
  isLoading,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Анализ на престои
            </h1>
            <p className="text-sm text-muted-foreground">
              Мониторинг на престои на мелници • Праг: {downtimeThreshold} t/h
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="w-[140px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.labelBg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Threshold Selector */}
            <Select
              value={downtimeThreshold.toString()}
              onValueChange={(v) => onThresholdChange(parseInt(v))}
            >
              <SelectTrigger className="w-[120px] bg-secondary border-border">
                <Settings className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 t/h</SelectItem>
                <SelectItem value="75">75 t/h</SelectItem>
                <SelectItem value="100">100 t/h</SelectItem>
                <SelectItem value="120">120 t/h</SelectItem>
                <SelectItem value="150">150 t/h</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              className="border-border"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
