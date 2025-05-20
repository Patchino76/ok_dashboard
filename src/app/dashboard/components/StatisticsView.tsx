'use client'

import React, { useMemo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { TagDefinition, TagTrendPoint } from '@/lib/tags/types'
import { 
  calculateStatistics, 
  processTrendDataForStatistics 
} from '../utils/statisticsCalculations'
import { Badge } from '@/components/ui/badge'
import { SimpleHistogram } from './SimpleHistogram'

type StatisticsViewProps = {
  trendData: TagTrendPoint[]
  definition: TagDefinition
  color?: string
}

export function StatisticsView({ trendData, definition, color = "#0ea5e9" }: StatisticsViewProps) {
  // Process data for statistics calculations
  const numericalValues = useMemo(() => 
    processTrendDataForStatistics(trendData), 
    [trendData]
  )

  // Calculate statistics
  const statistics = useMemo(() => 
    calculateStatistics(numericalValues), 
    [numericalValues]
  )

  // Format number with proper precision
  const formatNumber = (value: number) => {
    return definition.precision !== undefined ? 
      value.toFixed(definition.precision) : 
      value.toFixed(2)
  }

  if (!statistics) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <p className="text-muted-foreground">Недостатъчно данни за статистически анализ</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-[300px] border rounded-md p-3">
        <SimpleHistogram 
          data={numericalValues}
          color={color}
          mean={statistics.mean}
        />
      </div>
      
      {/* Statistics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard 
          title="Средна стойност" 
          value={`${formatNumber(statistics.mean)} ${definition.unit}`}
          colorClass="bg-blue-500"
        />
        <StatCard 
          title="Медиана" 
          value={`${formatNumber(statistics.median)} ${definition.unit}`}
          colorClass="bg-emerald-500"
        />
        <StatCard 
          title="Стандартно отклонение" 
          value={`${formatNumber(statistics.stdDev)} ${definition.unit}`}
          colorClass="bg-amber-500"
        />
        <StatCard 
          title="Брой измервания" 
          value={`${statistics.count}`}
          colorClass="bg-indigo-500"
        />
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard 
          title="Минимум" 
          value={`${formatNumber(statistics.min)} ${definition.unit}`}
          colorClass="bg-green-600"
        />
        <StatCard 
          title="Максимум"
          value={`${formatNumber(statistics.max)} ${definition.unit}`}
          colorClass="bg-red-600"
        />
        <StatCard 
          title="25-ти персентил" 
          value={`${formatNumber(statistics.q1)} ${definition.unit}`}
          colorClass="bg-teal-500"
        />
        <StatCard 
          title="75-ти персентил" 
          value={`${formatNumber(statistics.q3)} ${definition.unit}`}
          colorClass="bg-purple-500"
        />
      </div>
      
      <div className="border rounded-lg p-3 mt-4">
        <h4 className="text-sm font-medium mb-2">Разпределение спрямо стандартното отклонение</h4>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          <DistributionBadge label="-3σ" color="bg-red-500" value={formatNumber(statistics.mean - 3 * statistics.stdDev)} />
          <DistributionBadge label="-2σ" color="bg-amber-500" value={formatNumber(statistics.mean - 2 * statistics.stdDev)} />
          <DistributionBadge label="-1σ" color="bg-green-500" value={formatNumber(statistics.mean - statistics.stdDev)} />
          <DistributionBadge label="μ" color="bg-blue-500" value={formatNumber(statistics.mean)} />
          <DistributionBadge label="+1σ" color="bg-green-500" value={formatNumber(statistics.mean + statistics.stdDev)} />
          <DistributionBadge label="+2σ" color="bg-amber-500" value={formatNumber(statistics.mean + 2 * statistics.stdDev)} />
          <DistributionBadge label="+3σ" color="bg-red-500" value={formatNumber(statistics.mean + 3 * statistics.stdDev)} />
        </div>
      </div>
    </div>
  )
}

// Helper component for statistics cards
function StatCard({ title, value, colorClass }: { title: string, value: string, colorClass: string }) {
  return (
    <Card className="overflow-hidden border">
      <div className={`h-1.5 ${colorClass}`} />
      <CardContent className="p-3">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <div className="font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  )
}

// Helper component for distribution badges
function DistributionBadge({ label, color, value }: { label: string, color: string, value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Badge variant="outline" className={`${color} text-white text-xs px-2`}>
        {label}
      </Badge>
      <span className="text-xs">{value}</span>
    </div>
  )
}
