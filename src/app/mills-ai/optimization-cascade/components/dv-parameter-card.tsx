"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CascadeParameter } from "../stores/cascade-optimization-store";

interface DVParameterCardProps {
  parameter: CascadeParameter;
}

export function DVParameterCard({ parameter }: DVParameterCardProps) {
  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-emerald-50/90 dark:from-slate-800 dark:to-emerald-900/30 ring-2 ring-emerald-200/80 dark:ring-emerald-900/60 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span className="text-xl text-emerald-600">{parameter.icon}</span>
              {parameter.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-200"
              >
                DV
              </Badge>
              <span className="text-xs text-slate-500">Disturbance</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Current Value
          </div>
          <div className="text-2xl font-bold flex items-center gap-1 text-emerald-600">
            {parameter.value.toFixed(2)}
            <span className="text-xs text-slate-500">{parameter.unit}</span>
          </div>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Disturbance variables are monitored inputs that influence process behavior.
        </div>
      </CardContent>
    </Card>
  );
}
