"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  deliveryData,
  loadingByTarget,
  oreProcessing,
  targetDistribution,
  typeDistribution,
} from "../lib/mock-data";
import { BallsHeader } from "./balls-header";
import { DeliveryTable } from "./delivery-table";
import { PieDistributionCard } from "./pie-distribution-card";
import { BarChartCard } from "./bar-chart-card";
import { SummaryCards, type SummaryCard } from "./summary-cards";
import { BallsDatePicker } from "./balls-date-picker";

export default function BallsDashboard() {
  const [dateRange] = useState({
    start: "01 декември 2025 г.",
    end: "10 декември 2025 г.",
  });

  const [selectedDate, setSelectedDate] = useState("2025-12-10");

  const summaryCards: SummaryCard[] = useMemo(
    () => [
      {
        title: "Общо тегло",
        value: "262.02 t",
        subtitle: "за периода",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-blue-50 to-white",
        valueClassName: "text-3xl font-bold text-blue-600",
      },
      {
        title: "Брой доставки",
        value: "10",
        subtitle: "днес",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-green-50 to-white",
        valueClassName: "text-3xl font-bold text-green-600",
      },
      {
        title: "Среден товар",
        value: "2,070 kg",
        subtitle: "на доставка",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-purple-50 to-white",
        valueClassName: "text-3xl font-bold text-purple-600",
      },
      {
        title: "Активни МШЦ",
        value: "11",
        subtitle: "в работа",
        className:
          "shadow-sm border-gray-200 bg-gradient-to-br from-orange-50 to-white",
        valueClassName: "text-3xl font-bold text-orange-600",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <BallsHeader
          title="Измерване теглото на подаваните топки"
          dateLabel="10 декември 2025 г."
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
                    Дневни доставки на топки
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryTable rows={deliveryData} />
                </CardContent>
              </Card>

              <div className="space-y-6">
                <PieDistributionCard
                  title="Тотал по видове топки"
                  data={typeDistribution}
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
                  от {dateRange.start} до {dateRange.end}
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
