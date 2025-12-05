"use client";

import React from "react";
import { useMillsTrendByTag, useMills } from "@/lib/hooks/useMills";
import MillInfo from "./MillInfo";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface MillCardProps {
  mill: string;
  selectedParameter: string;
  onClick: () => void;
}

export function MillCard({ mill, selectedParameter, onClick }: MillCardProps) {
  const {
    data: millData,
    error: millError,
    isLoading: isMillLoading,
  } = useMills(mill);
  const {
    data: trendData,
    error: trendError,
    isLoading: isTrendLoading,
  } = useMillsTrendByTag(mill, selectedParameter);

  const isLoading = isMillLoading || isTrendLoading;

  // Loading state for individual card
  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center h-[480px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (millError || trendError || !millData || !trendData) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center h-[480px]">
          <p className="text-destructive">Грешка при зареждане на данните</p>
        </CardContent>
      </Card>
    );
  }

  // Render the mill info component
  return (
    <MillInfo millProps={millData} oreTrend={trendData} onClick={onClick} />
  );
}
