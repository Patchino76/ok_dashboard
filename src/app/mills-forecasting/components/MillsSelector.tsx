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
        const isDisabled = !isAllButton && selectedMills.includes(mill);
        const label = isAllButton ? "Всички" : mill.replace("Mill", "M");

        // Active state:
        // - All button: when list is empty
        // - Mill button: when NOT disabled (not in list)
        const isActive = isAllButton ? isAllActive : !isDisabled;

        return (
          <Button
            key={mill}
            size="sm"
            variant={isActive ? "default" : "outline"}
            className={`h-7 px-2 text-[11px] font-medium rounded-full ${
              isAllButton && isActive
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : !isAllButton && isActive
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "text-slate-500" // Explicit grey text for disabled
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
