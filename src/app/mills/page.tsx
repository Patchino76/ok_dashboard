"use client";
import React, { useState } from "react";
import { useMillsTrendByTag, useMills } from "@/lib/hooks/useMills";
import MillInfo from "./MillInfo";
import { millsNames } from "@/lib/tags/mills-tags";
import { Card, CardContent } from "@/components/ui/card";

export default function MillsPage() {
  const millsList = millsNames.map(mill => mill.en);
  const [selectedParameter, setSelectedParameter] = useState("ore");

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Мелнично</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {millsList.map((mill) => {
          // Fetch mill data directly in the main component
          const { data: millData, error: millError } = useMills(mill);
          const { data: trendData, error: trendError } = useMillsTrendByTag(mill, selectedParameter);
          
          // Handle error state
          if (millError || trendError || !millData || !trendData) {
            return (
              <Card key={mill} className="w-full max-w-md mx-auto">
                <CardContent className="flex items-center justify-center h-[480px]">
                  <p className="text-destructive">
                    Грешка при зареждане на данните
                  </p>
                </CardContent>
              </Card>
            );
          }
          
          // Render the mill info component directly
          return (
            <MillInfo 
              key={mill} 
              millProps={millData} 
              oreTrend={trendData}
            />
          );
        })}
      </div>
    </div>
  );
}
