"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DowntimeEvent } from "../lib/downtime-types";
import { formatDurationBg } from "../lib/downtime-utils";

interface DowntimeTimelineChartProps {
  events: DowntimeEvent[];
  millId: string;
  days?: number;
}

export function DowntimeTimelineChart({
  events,
  millId,
  days = 30,
}: DowntimeTimelineChartProps) {
  const millDisplayId = millId.replace("Mill", "MA");

  // Calculate timeline range
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const totalMs = now.getTime() - startDate.getTime();

  // Filter events for this mill and time range
  const timelineEvents = events
    .filter((e) => e.millId === millId && e.startTime >= startDate)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate position and width for each event
  const eventBlocks = timelineEvents.map((event) => {
    const startOffset = event.startTime.getTime() - startDate.getTime();
    const duration = event.endTime.getTime() - event.startTime.getTime();

    return {
      ...event,
      left: (startOffset / totalMs) * 100,
      width: Math.max((duration / totalMs) * 100, 0.5), // Minimum 0.5% width for visibility
    };
  });

  // Generate time labels
  const timeLabels = [];
  const labelCount = Math.min(days, 7); // Max 7 labels
  const labelInterval = days / labelCount;

  for (let i = 0; i <= labelCount; i++) {
    const date = new Date(
      startDate.getTime() + i * labelInterval * 24 * 60 * 60 * 1000
    );
    timeLabels.push({
      position: (i / labelCount) * 100,
      label: date.toLocaleDateString("bg-BG", {
        day: "numeric",
        month: "short",
      }),
    });
  }

  // Summary stats
  const minorCount = timelineEvents.filter(
    (e) => e.category === "minor"
  ).length;
  const majorCount = timelineEvents.filter(
    (e) => e.category === "major"
  ).length;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">
              Времева линия на престоите - {millDisplayId}
            </CardTitle>
            <CardDescription>Престои за последните {days} дни</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-yellow-500" />
              <span className="text-xs text-muted-foreground">
                Кратки ({minorCount})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500" />
              <span className="text-xs text-muted-foreground">
                ППР ({majorCount})
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Няма регистрирани престои за този период
          </div>
        ) : (
          <div className="space-y-4">
            {/* Timeline bar */}
            <div className="relative">
              {/* Background bar */}
              <div className="h-12 bg-secondary/30 rounded-lg relative overflow-hidden border border-border">
                {/* Event blocks */}
                {eventBlocks.map((event, index) => (
                  <div
                    key={event.id || index}
                    className={`absolute top-1 bottom-1 rounded cursor-pointer transition-opacity hover:opacity-80 ${
                      event.category === "minor"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      left: `${event.left}%`,
                      width: `${event.width}%`,
                      minWidth: "4px",
                    }}
                    title={`${event.reason}\n${formatDurationBg(
                      event.duration
                    )}\n${event.startTime.toLocaleString("bg-BG")}`}
                  />
                ))}
              </div>

              {/* Time labels */}
              <div className="relative h-6 mt-1">
                {timeLabels.map((label, index) => (
                  <span
                    key={index}
                    className="absolute text-xs text-muted-foreground transform -translate-x-1/2"
                    style={{ left: `${label.position}%` }}
                  >
                    {label.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {timelineEvents.slice(0, 10).map((event, index) => (
                <div
                  key={event.id || index}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        event.category === "minor"
                          ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                          : "bg-red-500/20 text-red-500 border-red-500/30"
                      }
                    >
                      {event.category === "minor" ? "Кратък" : "ППР"}
                    </Badge>
                    <span className="text-sm text-foreground">
                      {event.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatDurationBg(event.duration)}</span>
                    <span>
                      {event.startTime.toLocaleDateString("bg-BG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
              {timelineEvents.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  + още {timelineEvents.length - 10} събития
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
