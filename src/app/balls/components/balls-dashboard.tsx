"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BallsHeader } from "./balls-header";
import { DeliveryTable } from "./delivery-table";
import { PieDistributionCard } from "./pie-distribution-card";
import { BarChartCard } from "./bar-chart-card";
import { SummaryCards, type SummaryCard } from "./summary-cards";
import { BallsDatePicker } from "./balls-date-picker";
import { useBallsData } from "../hooks/useBallsData";
import { useBallsDataRange } from "../hooks/useBallsDataRange";
import type { BarDatum, DeliveryRow, PieDatum } from "../lib/types";

export default function BallsDashboard() {
  const [selectedDate, setSelectedDate] = useState("2025-12-10");

  const { data, isLoading, isError } = useBallsData(selectedDate);

  const monthStartDate = useMemo(() => {
    const dt = new Date(selectedDate);
    if (Number.isNaN(dt.getTime())) return selectedDate;
    const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, "0");
    const d = String(start.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const {
    data: monthData,
    isLoading: isMonthLoading,
    isError: isMonthError,
  } = useBallsDataRange(monthStartDate, selectedDate);

  const dateLabel = useMemo(() => {
    const dt = new Date(selectedDate);
    if (Number.isNaN(dt.getTime())) return selectedDate;
    return new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(dt);
  }, [selectedDate]);

  const monthStartLabel = useMemo(() => {
    const dt = new Date(monthStartDate);
    if (Number.isNaN(dt.getTime())) return monthStartDate;
    return new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(dt);
  }, [monthStartDate]);

  const dateRangeLabel = useMemo(() => {
    return { start: dateLabel, end: dateLabel };
  }, [dateLabel]);

  const deliveryRows: DeliveryRow[] = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const formatter = new Intl.DateTimeFormat("bg-BG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const sorted = [...rows].sort((a, b) => {
      const da = new Date(a.MeasureDate).getTime();
      const db = new Date(b.MeasureDate).getTime();
      if (Number.isNaN(da) || Number.isNaN(db)) return 0;
      return da - db;
    });

    return sorted.map((r) => {
      const dt = new Date(r.MeasureDate);
      const dateStr = Number.isNaN(dt.getTime())
        ? r.MeasureDate
        : formatter.format(dt);

      return {
        date: dateStr,
        shift: r.Shift,
        target: r.MillName,
        type: r.BallsName,
        weight: r.Gross,
        operator: r.Operator,
      };
    });
  }, [data]);

  const totals = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const totalKg = rows.reduce((sum, r) => sum + (Number(r.Gross) || 0), 0);
    const count = rows.length;
    const avgKg = count > 0 ? totalKg / count : 0;
    const mills = new Set(rows.map((r) => r.MillName));
    return {
      totalKg,
      totalTonnes: totalKg / 1000,
      count,
      avgKg,
      activeMills: mills.size,
    };
  }, [data]);

  const palette = useMemo(
    () => [
      "#22c55e",
      "#eab308",
      "#06b6d4",
      "#3b82f6",
      "#8b5cf6",
      "#f97316",
      "#ec4899",
      "#14b8a6",
      "#ef4444",
      "#0ea5e9",
      "#a855f7",
    ],
    []
  );

  const typeDistribution: PieDatum[] = useMemo(() => {
    const rows = Array.isArray(monthData) ? monthData : [];
    const byType = new Map<string, number>();
    for (const r of rows) {
      const key = r.BallsName || "";
      byType.set(key, (byType.get(key) || 0) + (Number(r.Gross) || 0));
    }

    const entries = Array.from(byType.entries())
      .map(([name, kg]) => ({ name, tonnes: kg / 1000 }))
      .sort((a, b) => b.tonnes - a.tonnes);

    return entries.map((e, idx) => ({
      name: e.name,
      value: Number(e.tonnes.toFixed(2)),
      color: palette[idx % palette.length],
    }));
  }, [monthData, palette]);

  const targetDistribution: PieDatum[] = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const byMill = new Map<string, number>();
    for (const r of rows) {
      const key = `МШЦ ${String(r.MillName).padStart(2, "0")}`;
      byMill.set(key, (byMill.get(key) || 0) + (Number(r.Gross) || 0));
    }

    const entries = Array.from(byMill.entries())
      .map(([name, kg]) => ({ name, tonnes: kg / 1000 }))
      .sort((a, b) => b.tonnes - a.tonnes);

    return entries.map((e, idx) => ({
      name: e.name,
      value: Number(e.tonnes.toFixed(2)),
      color: palette[idx % palette.length],
    }));
  }, [data, palette]);

  const loadingByTarget: BarDatum[] = useMemo(() => {
    return typeDistribution.map((t) => ({
      target: t.name,
      value: t.value,
      color: t.color,
    }));
  }, [typeDistribution]);

  const oreProcessing: BarDatum[] = useMemo(() => {
    return targetDistribution.map((t) => ({
      target: t.name,
      value: t.value,
      color: t.color,
    }));
  }, [targetDistribution]);

  const summaryCards: SummaryCard[] = useMemo(() => {
    return [
      {
        title: "Общо тегло",
        value: `${totals.totalTonnes.toFixed(2)} t`,
        subtitle: "за периода",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-blue-50 to-white",
        valueClassName: "text-3xl font-bold text-blue-600",
      },
      {
        title: "Брой доставки",
        value: String(totals.count),
        subtitle: "за деня",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-green-50 to-white",
        valueClassName: "text-3xl font-bold text-green-600",
      },
      {
        title: "Среден товар",
        value: `${Math.round(totals.avgKg)} kg`,
        subtitle: "на доставка",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-purple-50 to-white",
        valueClassName: "text-3xl font-bold text-purple-600",
      },
      {
        title: "Активни МШЦ",
        value: String(totals.activeMills),
        subtitle: "в работа",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-orange-50 to-white",
        valueClassName: "text-3xl font-bold text-orange-600",
      },
    ];
  }, [totals]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <BallsHeader
          title="Измерване теглото на подаваните топки"
          dateLabel={dateLabel}
        />

        <Tabs defaultValue="delivery" className="w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full grid-cols-3 bg-white border border-gray-200 sm:w-auto sm:min-w-[520px]">
              <TabsTrigger value="delivery">Подаване</TabsTrigger>
              <TabsTrigger value="analytics">Аналитика</TabsTrigger>
              <TabsTrigger value="reports">Справки</TabsTrigger>
            </TabsList>

            <div className="sm:flex-shrink-0">
              <BallsDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </div>
          </div>

          <TabsContent value="delivery" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl">
                    Дневен разход на топки
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-sm text-gray-600">Зареждане...</div>
                  ) : isError ? (
                    <div className="text-sm text-gray-600">
                      Грешка при зареждане на данните.
                    </div>
                  ) : deliveryRows.length === 0 ? (
                    <div className="text-sm text-gray-600">
                      Няма данни за избраната дата.
                    </div>
                  ) : (
                    <DeliveryTable rows={deliveryRows} />
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <PieDistributionCard
                  title={`Тотал по видове топки (${monthStartLabel} - ${dateLabel})`}
                  data={isMonthLoading || isMonthError ? [] : typeDistribution}
                  height={250}
                  showLegendList
                  labelFormatter={({ name, value }) =>
                    value > 0 ? `${name}: ${value}t` : ""
                  }
                />

                <PieDistributionCard
                  title="По целеви МШЦ"
                  data={targetDistribution}
                  height={200}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="text-xl">
                  Справки за изминали периоди на зареждане с топки и преработка
                  на руда
                </CardTitle>
                <p className="text-sm text-gray-500 mt-2">
                  от {dateRangeLabel.start} до {dateRangeLabel.end}
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                <BarChartCard
                  title="Зареждане според типа топки"
                  data={loadingByTarget}
                  useBarColors
                  barFill="#ec4899"
                />

                <BarChartCard
                  title="Тотал зареждане с топки"
                  data={oreProcessing}
                  barFill="#ec4899"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle>Справки и Експорт</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Функционалност за справки в процес на разработка...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <SummaryCards cards={summaryCards} />
      </div>
    </div>
  );
}
