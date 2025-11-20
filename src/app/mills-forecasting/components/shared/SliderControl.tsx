import { FC, memo } from "react";
import { Slider } from "@/components/ui/slider";

interface SliderControlProps {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  valueColor?: string;
  helpText?: string;
}

const SliderControlComponent: FC<SliderControlProps> = ({
  label,
  value,
  unit = "",
  min,
  max,
  step,
  onChange,
  valueColor = "text-slate-900",
  helpText,
}) => {
  const displayValue = step < 1 ? value.toFixed(1) : Math.round(value);

  const handleValueChange = (values: number[]) => {
    const newValue = values[0];
    if (newValue !== undefined && newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className={`text-sm font-bold ${valueColor}`}>
          {displayValue}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={handleValueChange}
      />
      {helpText && (
        <div className="text-[11px] text-slate-500 mt-1">{helpText}</div>
      )}
    </div>
  );
};

// Memoize the component to prevent re-renders when props haven't changed
export const SliderControl = memo(
  SliderControlComponent,
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if these specific props change
    return (
      prevProps.value === nextProps.value &&
      prevProps.label === nextProps.label &&
      prevProps.min === nextProps.min &&
      prevProps.max === nextProps.max &&
      prevProps.step === nextProps.step &&
      prevProps.unit === nextProps.unit &&
      prevProps.valueColor === nextProps.valueColor &&
      prevProps.helpText === nextProps.helpText
      // Note: We intentionally don't compare onChange since it's a function
    );
  }
);
