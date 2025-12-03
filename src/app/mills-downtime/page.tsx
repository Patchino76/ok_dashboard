"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "./components/dashboard-header";
import { OverviewStats } from "./components/overview-stats";
import { MillGrid } from "./components/mill-grid";
import { MillDetailPanel } from "./components/mill-detail-panel";
import { DowntimeChart } from "./components/downtime-chart";
import { ReasonBreakdownChart } from "./components/reason-breakdown-chart";
import { MillComparisonChart } from "./components/mill-comparison-chart";
import { EventsTable } from "./components/events-table";
import { ParetoChart } from "./components/pareto-chart";
import { DowntimeCategoryChart } from "./components/downtime-category-chart";
import { AvailabilityGauge } from "./components/availability-gauge";
import {
  calculateMillMetrics,
  getMillComparisonData,
} from "./lib/downtime-detection";
import { MILLS } from "./lib/downtime-utils";
import {
  useAllMillsDowntimeData,
  useMillDowntimeData,
  getRecentEvents,
  TIME_RANGE_OPTIONS,
} from "./hooks/useDowntimeData";
import type { TimeRange, DowntimeConfig } from "./lib/downtime-types";
import { LayoutGrid, BarChart3, Clock, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DowntimeDashboardPage() {
  // State
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [downtimeThreshold, setDowntimeThreshold] = useState(10);
  const [selectedMill, setSelectedMill] = useState<string | undefined>();
  const [comparisonMetric, setComparisonMetric] = useState<
    "availability" | "mtbf" | "mttr"
  >("availability");
  const [downtimeFilter, setDowntimeFilter] = useState<
    "all" | "minor" | "major"
  >("all");

  // Config
  const config: DowntimeConfig = useMemo(
    () => ({
      downtimeThreshold,
      minorDowntimeMaxMinutes: 60,
    }),
    [downtimeThreshold]
  );

  // Fetch all mills data
  const {
    events,
    millMetrics,
    aggregateMetrics,
    downtimesByDay,
    downtimesByReason,
    millComparisonData,
    trendDataByMill,
    isLoading,
    isError,
    refetch,
  } = useAllMillsDowntimeData(timeRange, config);

  // Recalculate comparison data based on filter
  const filteredMillComparisonData = useMemo(() => {
    if (downtimeFilter === "all") return millComparisonData;

    const days =
      TIME_RANGE_OPTIONS.find((t) => t.value === timeRange)?.days || 30;
    const totalMinutes = days * 24 * 60;

    // Filter events
    const filteredEvents = events.filter((e) => e.category === downtimeFilter);

    // Recalculate metrics for each mill
    const filteredMetrics = MILLS.map((mill) => {
      const currentData = millMetrics.find((m) => m.millId === mill.id);
      return calculateMillMetrics(
        mill.id,
        filteredEvents,
        totalMinutes,
        currentData?.currentOreRate || 0,
        currentData?.isRunning || false
      );
    });

    return getMillComparisonData(filteredMetrics);
  }, [downtimeFilter, events, millComparisonData, timeRange, millMetrics]);

  // Fetch selected mill data
  const selectedMillData = useMillDowntimeData(
    selectedMill || "",
    timeRange,
    config
  );

  // Get recent events
  const recentEvents = useMemo(
    () => getRecentEvents(events, undefined, 10),
    [events]
  );

  // Get best and worst mills
  const { bestMill, worstMill } = useMemo(() => {
    if (millMetrics.length === 0) {
      return { bestMill: null, worstMill: null };
    }
    const sorted = [...millMetrics].sort(
      (a, b) => b.availability - a.availability
    );
    return {
      bestMill: sorted[0],
      worstMill: sorted[sorted.length - 1],
    };
  }, [millMetrics]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        downtimeThreshold={downtimeThreshold}
        onThresholdChange={setDowntimeThreshold}
        onRefresh={refetch}
        isLoading={isLoading}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Overview Stats */}
        <OverviewStats metrics={aggregateMetrics} isLoading={isLoading} />

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Преглед
            </TabsTrigger>
            <TabsTrigger
              value="comparison"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Сравнение
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Clock className="h-4 w-4 mr-2" />
              Анализ
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Детайли
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Availability Gauges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AvailabilityGauge
                value={aggregateMetrics.avgAvailability}
                title="Обща коеф. движение"
              />
              {bestMill && (
                <AvailabilityGauge
                  value={bestMill.availability}
                  title={`Най-добра: ${bestMill.millName}`}
                />
              )}
              {worstMill && (
                <AvailabilityGauge
                  value={worstMill.availability}
                  title={`Нужда от внимание: ${worstMill.millName}`}
                />
              )}
              <AvailabilityGauge
                value={
                  aggregateMetrics.avgMtbf > 0
                    ? (aggregateMetrics.avgMtbf /
                        (aggregateMetrics.avgMtbf + aggregateMetrics.avgMttr)) *
                      100
                    : 0
                }
                title="Индекс на надеждност"
              />
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <DowntimeChart data={downtimesByDay} />
              <ReasonBreakdownChart data={downtimesByReason} />
            </div>

            {/* Events Table */}
            <EventsTable events={recentEvents} />
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            {/* Metric Selector */}
            <div className="flex flex-wrap gap-2">
              {(["availability", "mtbf", "mttr"] as const).map((metric) => (
                <Button
                  key={metric}
                  variant={comparisonMetric === metric ? "default" : "outline"}
                  onClick={() => setComparisonMetric(metric)}
                  className="h-9"
                >
                  {metric === "mtbf"
                    ? "MTBF"
                    : metric === "mttr"
                    ? "MTTR"
                    : "Коеф. движение"}
                </Button>
              ))}
            </div>

            {/* Comparison Chart */}
            <MillComparisonChart
              data={filteredMillComparisonData}
              metric={comparisonMetric}
              categoryFilter={downtimeFilter}
              onCategoryFilterChange={setDowntimeFilter}
            />

            {/* Additional Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <ParetoChart data={downtimesByReason} />
              <DowntimeCategoryChart metrics={aggregateMetrics} />
            </div>
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <ParetoChart data={downtimesByReason} />
              <DowntimeCategoryChart metrics={aggregateMetrics} />
            </div>
            <EventsTable events={events} title="Всички събития" />
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Изберете мелница
              </h2>
              <MillGrid
                millMetrics={millMetrics}
                onSelectMill={setSelectedMill}
                selectedMill={selectedMill}
                isLoading={isLoading}
              />
            </div>

            {selectedMill && (
              <MillDetailPanel
                millId={selectedMill}
                metrics={selectedMillData.metrics}
                events={selectedMillData.events}
                feedRateData={selectedMillData.feedRateData}
                downtimeThreshold={downtimeThreshold}
                onClose={() => setSelectedMill(undefined)}
                isLoading={selectedMillData.isLoading}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
