import { FC, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const variantStyles = {
  default: "bg-white border-slate-200",
  success: "bg-emerald-50 border-emerald-200",
  warning: "bg-amber-50 border-amber-200",
  danger: "bg-red-50 border-red-200",
};

export const MetricCard: FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className = "",
}) => {
  return (
    <Card className={`p-2 ${variantStyles[variant]} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-600 mb-1">{title}</div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {value}
          </div>
          {subtitle && (
            <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        {Icon && (
          <Icon className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
        )}
      </div>
    </Card>
  );
};
