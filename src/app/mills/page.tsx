"use client";
import React, { useState, useMemo } from "react";
import MillDetailPopup from "./MillDetailPopup";
import { MillCard } from "./MillCard";
import { millsNames } from "@/lib/tags/mills-tags";

export default function MillsPage() {
  const millsList = useMemo(() => millsNames.map((mill) => mill.en), []);
  const [selectedParameter] = useState("ore");
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

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Мелнично</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {millsList.map((mill) => (
          <MillCard
            key={mill}
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
