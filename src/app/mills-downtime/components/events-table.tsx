"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DowntimeEvent } from "../lib/downtime-types";
import {
  formatDurationBg,
  formatReason,
  getCategoryLabel,
} from "../lib/downtime-utils";
import { MILLS } from "../lib/downtime-utils";

interface EventsTableProps {
  events: DowntimeEvent[];
  showMill?: boolean;
  title?: string;
  description?: string;
}

export function EventsTable({
  events,
  showMill = true,
  title = "Последни престои",
  description = "Последни инциденти с престой на мелниците",
}: EventsTableProps) {
  const getMillName = (millId: string) => {
    const mill = MILLS.find((m) => m.id === millId);
    return mill?.nameBg || millId;
  };

  if (events.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Няма регистрирани престои за избрания период
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {showMill && (
                <TableHead className="text-muted-foreground">Мелница</TableHead>
              )}
              <TableHead className="text-muted-foreground">Начало</TableHead>
              <TableHead className="text-muted-foreground">
                Продължителност
              </TableHead>
              <TableHead className="text-muted-foreground">Категория</TableHead>
              <TableHead className="text-muted-foreground">Причина</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id} className="border-border">
                {showMill && (
                  <TableCell className="font-medium text-foreground">
                    {getMillName(event.millId)}
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {event.startTime.toLocaleString("bg-BG", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="text-foreground font-mono">
                  {formatDurationBg(event.duration)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      event.category === "minor" ? "secondary" : "destructive"
                    }
                    className={
                      event.category === "minor"
                        ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                        : "bg-red-500/20 text-red-500 border-red-500/30"
                    }
                  >
                    {getCategoryLabel(event.category)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatReason(event.reason)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
