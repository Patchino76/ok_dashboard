"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isLoading: boolean;
  className?: string;
}

export function LoadingOverlay({ isLoading, className }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-xl bg-card p-8 shadow-2xl border border-border">
        {/* Animated spinner with glow effect */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
        </div>

        {/* Loading text */}
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">
            Зареждане на данни...
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Тези данни се зареждат по-бавно. Имайте търпение.
          </p>
        </div>

        {/* Progress dots animation */}
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
