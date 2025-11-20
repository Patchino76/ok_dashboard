import { FC } from "react";
import { Button } from "@/components/ui/button";

interface MillsSelectorProps {
  mills: string[];
  selectedMills: string[];
  onSelectMill: (mill: string) => void;
}

export const MillsSelector: FC<MillsSelectorProps> = ({
  mills,
  selectedMills,
  onSelectMill,
}) => {
  return (
    <div className="flex flex-wrap gap-1">
      {mills.map((mill) => {
        const isAllButton = mill === "all";
        const isAllActive = isAllButton && selectedMills.length === 0;
        const isSelected = !isAllButton && selectedMills.includes(mill);
        const label = isAllButton ? "All" : mill.replace("Mill_", "M");

        return (
          <Button
            key={mill}
            size="sm"
            variant={
              isAllButton
                ? isAllActive
                  ? "default"
                  : "outline"
                : isSelected
                ? "default"
                : "outline"
            }
            className={`h-7 px-2 text-[11px] font-medium rounded-full ${
              isAllButton && isAllActive
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : isSelected
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : ""
            }`}
            onClick={() => onSelectMill(mill)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
};
