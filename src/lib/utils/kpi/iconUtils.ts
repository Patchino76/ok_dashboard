import React from 'react';
import { 
  Waves, 
  GaugeCircle, 
  ArrowRightLeft, 
  Weight, 
  Activity, 
  Timer, 
  Hammer, 
  Container, 
  Factory, 
  Cylinder,
  CalendarClock
} from "lucide-react";

/**
 * Renders the appropriate icon based on the icon property
 * @param iconType The icon type string from tag definition
 * @param size Optional size for the icon
 * @returns React component for the icon
 */
export const renderTagIcon = (iconType: string | null, size = 16) => {
  if (!iconType) return null;
  
  const iconProps = { size };
  
  switch (iconType) {
    case 'level':
      return React.createElement(Cylinder, iconProps); // Better for level measurements in containers
    case 'conveyer':
      return React.createElement(ArrowRightLeft, iconProps); // Represents material movement on conveyers
    case 'weight':
      return React.createElement(Weight, iconProps); // Perfect for weight measurements
    case 'flotaion':
      return React.createElement(Container, iconProps); // Container representing flotation cells
    case 'power':
      return React.createElement(Activity, iconProps); // For power/electricity
    case 'time':
      return React.createElement(Timer, iconProps); // For time-based measurements
    case 'crusher':
      return React.createElement(Hammer, iconProps); // For crushers/mills
    case 'factory':
      return React.createElement(Factory, iconProps); // For production areas
    case 'total':
      return React.createElement(CalendarClock, iconProps); // For accumulated totals
    default:
      return React.createElement(GaugeCircle, iconProps); // Default fallback
  }
};
