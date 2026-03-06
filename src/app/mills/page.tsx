"use client";
import React, { useState, useMemo } from "react";
import MillDetailPopup from "./MillDetailPopup";
import { MillCard } from "./MillCard";
import { millsNames } from "@/lib/tags/mills-tags";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const parameterOptions = [
  { value: "ore", label: "Руда (t/h)" },
  { value: "WaterMill", label: "Вода мелница (m³/h)" },
  { value: "WaterZumpf", label: "Вода зумпф (m³/h)" },
  { value: "Power", label: "Мощност (kW)" },
  { value: "ZumpfLevel", label: "Ниво зумпф (mm)" },
  { value: "PressureHC", label: "Налягане ХЦ (bar)" },
  { value: "DensityHC", label: "Плътност ХЦ (kg/cm³)" },
  { value: "PulpHC", label: "Пулп ХЦ (m³/h)" },
];

export default function MillsPage() {
  const millsList = useMemo(() => millsNames.map((mill) => mill.en), []);
  const [selectedParameter, setSelectedParameter] = useState("ore");
  const [selectedMill, setSelectedMill] = useState<string | null>(null);

  const handleMillClick = (millName: string) => {
    setSelectedMill(millName);
  };

  const handleClosePopup = () => {
    setSelectedMill(null);
  };

  // Get Bulgarian name for the selected mill
  const getMillBgName = (enName: string) => {
    const mill = millsNames.find((m) => m.en === enName);
    return mill?.bg || enName;
  };

  const currentParamLabel =
    parameterOptions.find((p) => p.value === selectedParameter)?.label ??
    selectedParameter;

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Мелнично</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 whitespace-nowrap">
            Параметър:
          </span>
          <Select
            value={selectedParameter}
            onValueChange={setSelectedParameter}
          >
            <SelectTrigger className="w-[220px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {parameterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {millsList.map((mill) => (
          <MillCard
            key={`${mill}-${selectedParameter}`}
            mill={mill}
            selectedParameter={selectedParameter}
            onClick={() => handleMillClick(mill)}
          />
        ))}
      </div>

      {/* Mill Detail Popup */}
      <MillDetailPopup
        isOpen={selectedMill !== null}
        onClose={handleClosePopup}
        millName={selectedMill ? getMillBgName(selectedMill) : ""}
      />
    </div>
  );
}
