"use client";
import React, { useState } from "react";
import { useMillsTrendByTag, useMills } from "@/lib/hooks/useMills";
import MillInfo from "./MillInfo";
import { millsNames } from "@/lib/tags/mills-tags";
// Grid is implemented using Tailwind CSS grid classes
import { Card, CardContent } from "@/components/ui/card";

export default function MillsPage() {
  const millsList = millsNames.map(mill => mill.en);
  const [selectedParameter, setSelectedParameter] = useState("ore");

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Мелнично</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {millsList.map((mill) => (
          <MillInfoWrapper 
            key={mill} 
            mill={mill} 
            tag={selectedParameter}
          />
        ))}
      </div>
    </div>
  );
}

function MillInfoWrapper({ mill, tag }: { mill: string; tag: string }) {
  const { data: millData, isLoading: millLoading, error: millError } = useMills(mill);
  const { data: trendData, isLoading: trendLoading, error: trendError } = useMillsTrendByTag(mill, tag);

  if (millLoading || trendLoading) {
    return (
      <Card className="w-full max-w-md mx-auto h-[480px] flex items-center justify-center">
        <CardContent>
          <div className="animate-pulse flex flex-col items-center space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-48 bg-gray-200 rounded w-full"></div>
            <div className="space-y-2 w-full">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (millError || trendError || !millData || !trendData) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center h-[480px]">
          <p className="text-destructive">
            Грешка при зареждане на данните
          </p>
        </CardContent>
      </Card>
    );
  }

  return <MillInfo millProps={millData} oreTrend={trendData} />;
}
