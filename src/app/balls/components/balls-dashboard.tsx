"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { BallsHeader } from "./balls-header";
import { DeliveryTable } from "./delivery-table";
import { PieDistributionCard } from "./pie-distribution-card";
import { BarChartCard } from "./bar-chart-card";
import { SummaryCards, type SummaryCard } from "./summary-cards";
import { BallsDatePicker } from "./balls-date-picker";
import { useBallsDataRange } from "../hooks/useBallsDataRange";
import type { BarDatum, DeliveryRow, PieDatum } from "../lib/types";

export default function BallsDashboard() {
  const [selectedMonth, setSelectedMonth] = useState("2025-12");
  const [selectedDate, setSelectedDate] = useState("2025-12-10");

  const monthStartDate = useMemo(() => {
    if (!selectedMonth || selectedMonth.length < 7) return "";
    return `${selectedMonth}-01`;
  }, [selectedMonth]);

  const monthEndDate = useMemo(() => {
    if (!selectedMonth || selectedMonth.length < 7) return "";

    const [yStr, mStr] = selectedMonth.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return "";

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth() + 1;

    const isCurrentMonth = year === todayY && month === todayM;
    if (isCurrentMonth) {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const last = new Date(year, month, 0);
    const y = last.getFullYear();
    const m = String(last.getMonth() + 1).padStart(2, "0");
    const d = String(last.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedMonth]);

  const handleMonthChange = (nextMonth: string) => {
    setSelectedMonth(nextMonth);

    const newStart =
      nextMonth && nextMonth.length >= 7 ? `${nextMonth}-01` : "";
    if (!newStart) return;

    const [yStr, mStr] = nextMonth.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return;

    const today = new Date();
    const isCurrentMonth =
      year === today.getFullYear() && month === today.getMonth() + 1;

    const newEnd = isCurrentMonth
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(today.getDate()).padStart(2, "0")}`
      : (() => {
          const last = new Date(year, month, 0);
          return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(
            2,
            "0"
          )}-${String(last.getDate()).padStart(2, "0")}`;
        })();

    setSelectedDate((prev) => {
      if (!prev) return newStart;
      if (prev < newStart) return newStart;
      if (prev > newEnd) return newEnd;
      return prev;
    });
  };

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    if (nextDate && nextDate.length >= 7) {
      const nextMonth = nextDate.slice(0, 7);
      if (nextMonth !== selectedMonth) setSelectedMonth(nextMonth);
    }
  };

  const {
    data,
    isLoading: isMonthLoading,
    isError: isMonthError,
  } = useBallsDataRange(monthStartDate, monthEndDate);

  const startLabel = useMemo(() => {
    const dt = new Date(monthStartDate);
    if (Number.isNaN(dt.getTime())) return monthStartDate;
    return new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(dt);
  }, [monthStartDate]);

  const endLabel = useMemo(() => {
    const dt = new Date(monthEndDate);
    if (Number.isNaN(dt.getTime())) return monthEndDate;
    return new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(dt);
  }, [monthEndDate, monthStartDate]);

  const dateRangeLabel = useMemo(() => {
    return { start: startLabel, end: endLabel };
  }, [endLabel, startLabel]);

  const deliveryRows: DeliveryRow[] = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const filteredRows = selectedDate
      ? rows.filter((r) => {
          const dt = new Date(r.MeasureDate);
          if (Number.isNaN(dt.getTime())) return false;
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, "0");
          const d = String(dt.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}` === selectedDate;
        })
      : rows;
    const formatter = new Intl.DateTimeFormat("bg-BG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const sorted = [...filteredRows].sort((a, b) => {
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
        isDosmilane: Boolean(r.IsDosmilane),
      };
    });
  }, [data, selectedDate]);

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
    const rows = Array.isArray(data) ? data : [];
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
      value: Number(e.tonnes.toFixed(1)),
      color: palette[idx % palette.length],
    }));
  }, [data, palette]);

  const oreProcessingStackedKeys = useMemo(() => {
    return typeDistribution.map((t) => t.name);
  }, [typeDistribution]);

  const oreProcessingStackedKeyColors = useMemo(() => {
    return Object.fromEntries(typeDistribution.map((t) => [t.name, t.color]));
  }, [typeDistribution]);

  const oreProcessingStacked = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];

    const byMill = new Map<number, Record<string, number>>();
    for (const r of rows) {
      const mill = Number(r.MillName);
      if (!Number.isFinite(mill)) continue;
      const type = String(r.BallsName || "");
      const kg = Number(r.Gross) || 0;
      if (!byMill.has(mill)) byMill.set(mill, {});
      const entry = byMill.get(mill)!;
      entry[type] = (entry[type] || 0) + kg / 1000;
    }

    const labelForMill = (mill: number) => {
      if (mill === 21) return "Д1";
      if (mill === 22) return "Д2";
      return `MA ${String(mill).padStart(2, "0")}`;
    };

    const sortKeyForMill = (mill: number) => {
      if (mill === 21) return 1000;
      if (mill === 22) return 1001;
      return mill;
    };

    return Array.from(byMill.entries())
      .sort(([a], [b]) => sortKeyForMill(a) - sortKeyForMill(b))
      .map(([mill, totalsByType]) => {
        const item: Record<string, any> = {
          target: labelForMill(mill),
        };
        let total = 0;
        let topKey = "";
        for (const key of oreProcessingStackedKeys) {
          const v = totalsByType[key] || 0;
          item[key] = Number(v.toFixed(1));
          if (v > 0) topKey = key;
          total += v;
        }
        item.__total = Number(total.toFixed(1));
        item.__topKey = topKey;
        return item;
      });
  }, [data, oreProcessingStackedKeys]);

  const millDailyBars: BarDatum[] = useMemo(() => {
    if (!selectedDate) return [];
    const rows = Array.isArray(data) ? data : [];

    const typeColorMap = new Map(
      typeDistribution.map((t) => [t.name, t.color])
    );

    const byMill = new Map<
      number,
      { totalKg: number; byTypeKg: Map<string, number> }
    >();

    for (const r of rows) {
      const dt = new Date(r.MeasureDate);
      if (Number.isNaN(dt.getTime())) continue;
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${d}`;
      if (iso !== selectedDate) continue;

      if (Boolean(r.IsDosmilane)) continue;

      const mill = Number(r.MillName);
      if (!Number.isFinite(mill)) continue;

      const kg = Number(r.Gross) || 0;
      const ballType = String(r.BallsName || "");

      const entry = byMill.get(mill) ?? {
        totalKg: 0,
        byTypeKg: new Map<string, number>(),
      };
      entry.totalKg += kg;
      entry.byTypeKg.set(ballType, (entry.byTypeKg.get(ballType) || 0) + kg);
      byMill.set(mill, entry);
    }

    const result: BarDatum[] = Array.from(byMill.entries())
      .sort(([a], [b]) => a - b)
      .map(([mill, agg]) => {
        let dominantType = "";
        let dominantKg = -1;
        for (const [t, kg] of agg.byTypeKg.entries()) {
          if (kg > dominantKg) {
            dominantKg = kg;
            dominantType = t;
          }
        }

        return {
          target: `MA ${String(mill).padStart(2, "0")}`,
          value: Number((agg.totalKg / 1000).toFixed(2)),
          color: typeColorMap.get(dominantType) || "#94a3b8",
          ballType: dominantType,
        };
      });

    return result;
  }, [data, selectedDate, typeDistribution]);

  const targetDistribution: PieDatum[] = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const byMill = new Map<string, number>();
    for (const r of rows) {
      const key = `MA ${String(r.MillName).padStart(2, "0")}`;
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
        subtitle: "за периода",
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
          dateLabel={`${dateRangeLabel.start} - ${dateRangeLabel.end}`}
        />

        <Tabs defaultValue="delivery" className="w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full grid-cols-3 bg-white border border-gray-200 sm:w-auto sm:min-w-[520px]">
              <TabsTrigger value="delivery">Подаване</TabsTrigger>
              <TabsTrigger value="analytics">Аналитика</TabsTrigger>
              <TabsTrigger value="reports">Справки</TabsTrigger>
            </TabsList>

            <div className="sm:flex-shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  Дата:
                </span>
                <div className="w-full sm:w-48">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={monthStartDate || undefined}
                    max={monthEndDate || undefined}
                    className="bg-white border-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>

          <TabsContent value="delivery" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-3 shadow-sm border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl">Разход на топки</CardTitle>
                </CardHeader>
                <CardContent>
                  {isMonthLoading ? (
                    <div className="text-sm text-gray-600">Зареждане...</div>
                  ) : isMonthError ? (
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

              <div className="space-y-6 lg:col-span-2">
                <Card className="shadow-sm border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      По целеви МШЦ (за деня)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChartCard
                      title=""
                      data={isMonthLoading || isMonthError ? [] : millDailyBars}
                      useBarColors
                      height={320}
                      showLegend={false}
                      showTitle={false}
                      axisTickFontSize={10}
                      showValueLabels
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Справки и Експорт</CardTitle>
                <BallsDatePicker
                  value={selectedMonth}
                  onChange={handleMonthChange}
                />
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Функционалност за справки в процес на разработка...
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">
                  Тотал зареждане с топки
                </CardTitle>
                <p className="text-sm text-gray-500 mt-2">
                  от {dateRangeLabel.start} до {dateRangeLabel.end}
                </p>
              </CardHeader>
              <CardContent>
                <BarChartCard
                  title=""
                  data={oreProcessingStacked}
                  barFill="#ec4899"
                  showTitle={false}
                  showLegend={false}
                  yAxisUnit="t"
                  showValueLabels
                  axisTickFontSize={11}
                  valueDecimals={1}
                  stackedKeys={oreProcessingStackedKeys}
                  stackedKeyColors={oreProcessingStackedKeyColors}
                  height={360}
                />
              </CardContent>
            </Card>

            <PieDistributionCard
              title={`Тотал по видове топки (${dateRangeLabel.start} - ${dateRangeLabel.end})`}
              data={
                isMonthLoading || isMonthError
                  ? []
                  : typeDistribution.map((row) => ({
                      ...row,
                      value: Number(row.value.toFixed(1)),
                    }))
              }
              height={260}
              showLegendList
              labelFormatter={({
                name,
                value,
              }: {
                name: string;
                value: number;
              }) => (value > 0 ? `${name}: ${value.toFixed(1)}t` : "")}
            />
          </TabsContent>
        </Tabs>

        <SummaryCards cards={summaryCards} />
      </div>
    </div>
  );
}
