import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format numbers with specified decimal places and locale formatting
export function formatNumber(value: number | string | boolean | null | undefined, precision: number = 0): string {
  if (value === null || value === undefined) return '-';
  
  // Convert to number if it's a string or boolean
  const numValue = typeof value === 'boolean' ? (value ? 1 : 0) : 
                  typeof value === 'string' ? parseFloat(value) : value;
  
  // Check if it's a valid number
  if (isNaN(numValue)) return '-';
  
  return numValue.toLocaleString('bg-BG', { 
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
}

// Mapping of Tailwind color classes to hex values
const tailwindColors = {
  "amber-600": "#d97706",
  "amber-500": "#f59e0b",
  "amber-400": "#fbbf24",
  "red-500": "#ef4444",
  "blue-600": "#2563eb",
  "blue-500": "#3b82f6",
  "blue-400": "#60a5fa",
  "blue-300": "#93c5fd",
  "blue-200": "#bfdbfe",
  "green-500": "#22c55e",
  "purple-600": "#9333ea",
  "purple-500": "#a855f7",
  "purple-400": "#c084fc",
  "teal-500": "#14b8a6",
  "cyan-500": "#06b6d4",
  "gray-500": "#6b7280",
}

// Get border color class from group name
export function getBorderColorFromGroup(group: string): string {
  // Process areas - KET groups
  if (group.includes('КЕТ')) {
    if (group.includes('1')) {
      return "border-l-amber-600";
    } else if (group.includes('3')) {
      return "border-l-amber-500";
    } else {
      return "border-l-amber-400";
    }
  }
  // MGTL
  else if (group.includes('МГТ')) {
    return "border-l-red-500";
  }
  // SST
  else if (group.includes('ССТ')) {
    return "border-l-blue-600";
  }
  // Streams
  else if (group.includes('Поток')) {
    if (group.includes('1-4')) {
      return "border-l-blue-500";
    } else if (group.includes('5-13')) {
      return "border-l-blue-400";
    } else if (group.includes('15')) {
      return "border-l-blue-300";
    } else if (group.includes('16')) {
      return "border-l-blue-200";
    }
  }
  // Bunkers
  else if (group.includes('Бунк')) {
    return "border-l-green-500";
  }
  // Mills
  else if (group.includes('Мелн')) {
    return "border-l-purple-600";
  }
  // Flotation
  else if (group.includes('Флот')) {
    return "border-l-purple-500";
  }
  // Filter Press
  else if (group.includes('Прес')) {
    return "border-l-purple-400";
  }
  // Auto Scale
  else if (group.includes('везна')) {
    return "border-l-teal-500";
  }
  // Water Park
  else if (group.includes('ВХС')) {
    return "border-l-cyan-500";
  }
  
  // Default color
  return "border-l-gray-500";
}

// Get hex color from group name
export function getColorFromGroup(group: string): string {
  const borderClass = getBorderColorFromGroup(group);
  // Extract the color name from the border class (e.g., "border-l-amber-600" -> "amber-600")
  const colorName = borderClass.replace('border-l-', '');
  // Return the corresponding hex value or a default gray
  return tailwindColors[colorName as keyof typeof tailwindColors] || tailwindColors["gray-500"];
}
