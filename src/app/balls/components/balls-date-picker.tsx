"use client";

import React from "react";
import { Input } from "@/components/ui/input";

type BallsDatePickerProps = {
  value: string;
  onChange: (next: string) => void;
};

export function BallsDatePicker({ value, onChange }: BallsDatePickerProps) {
  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <span className="text-sm text-gray-600 whitespace-nowrap">Дата:</span>
      <div className="w-full sm:w-48">
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white border-gray-200"
        />
      </div>
    </div>
  );
}
