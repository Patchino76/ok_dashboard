'use client';

import { KpiDashboard } from './KpiDashboard';

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">KPI Dashboard</h1>
        <p className="text-muted-foreground">
          Мониторинг на KPIs и производствени метрики в реално време
        </p>
      </div>
      
      <KpiDashboard />
    </div>
  );
}
