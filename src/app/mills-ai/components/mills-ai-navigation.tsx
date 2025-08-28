"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigationItems = [
  { name: "Process Control", href: "/mills-ai" },
  { name: "XGBoost Simulation", href: "/mills-ai/simulation" },
  { name: "Process Optimization", href: "/mills-ai/optimization" },
  { name: "Model Training", href: "/mills-ai/model-training" },
  { name: "Multi-Parameter", href: "/mills-ai/multi-parameter" }
]

export function MillsAINavigation() {
  const pathname = usePathname()

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 shadow-sm rounded-lg overflow-hidden">
      <div className="flex overflow-x-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || 
                          (item.href !== "/mills-ai" && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              {item.name}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
