# Mills Forecasting Data Binding Proposal

## Executive Summary

This document proposes a clean architecture for binding real-time production data to the mills-forecasting UI, following the proven patterns from MillsPage while maintaining separation of concerns.

## Current State Analysis

### MillsPage Data Loading Pattern

```typescript
// Uses React Query hooks directly in components
const { data: millData } = useMills(mill);
const { data: trendData } = useMillsTrendByTag(mill, selectedParameter);
```

**Key characteristics:**

- Direct API integration via React Query hooks
- Real-time data fetching with 20s refresh intervals
- Component-level data management
- No centralized state store

### Mills-Forecasting Current State

```typescript
// Uses local state + custom hook for calculations
const [currentOreRate, setCurrentOreRate] = useState(169.67);
const { forecast } = useProductionForecast({
  currentOreRate,
  adjustedOreRate,
  // ... other params
});
```

**Issues:**

- Hardcoded default values (169.67)
- No real-time data integration
- Manual user input only
- Calculations based on assumptions, not actual production data

## Proposed Architecture

### 1. Create Custom React Query Hooks

**File:** `src/app/mills-forecasting/hooks/useMillsProductionData.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api-client";

/**
 * Fetch current production data for all mills
 * Returns: shift totals, current ore rates, mill states
 */
export function useMillsProductionData(refreshInterval: number = 20) {
  return useQuery({
    queryKey: ["mills-production-all"],
    queryFn: async () => {
      // Fetch data for all mills in parallel
      const millsList = ["Mill_1", "Mill_2", ..., "Mill_10"];
      const promises = millsList.map(mill =>
        apiClient.get(`/mills/ore-by-mill`, { params: { mill } })
      );
      const results = await Promise.all(promises);

      // Aggregate data
      return {
        mills: results.map(r => r.data),
        totalOreRate: calculateTotalOreRate(results),
        activeMillsCount: results.filter(r => r.data.state).length,
        shiftProduction: calculateShiftProduction(results),
        dayProduction: calculateDayProduction(results),
      };
    },
    staleTime: 0,
    refetchInterval: refreshInterval * 1000,
    networkMode: "always",
  });
}

/**
 * Fetch historical production trends for forecasting
 */
export function useMillsProductionTrends(
  hours: number = 8,
  refreshInterval: number = 60
) {
  return useQuery({
    queryKey: ["mills-production-trends", hours],
    queryFn: async () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      const response = await apiClient.get(`/mills/all_mills_by_param`, {
        params: {
          parameter: "Ore",
          start_ts: startTime.toISOString(),
          end_ts: endTime.toISOString(),
          freq: "5min",
        },
      });

      return response.data;
    },
    staleTime: 30000,
    refetchInterval: refreshInterval * 1000,
  });
}
```

### 2. Create Zustand Store for Forecasting Settings

**File:** `src/app/mills-forecasting/stores/forecastingStore.ts`

```typescript
import { create } from "zustand";

interface ForecastingSettings {
  // User-adjustable settings
  shiftTarget: number;
  dayTarget: number;
  adjustedOreRate: number;
  uncertaintyLevel: 1 | 2 | 3;
  selectedMills: string[];

  // Real-time data (populated from API)
  currentOreRate: number;
  actualShiftProduction: number;
  actualDayProduction: number;
  activeMillsCount: number;

  // UI state
  isRealTimeMode: boolean;
  lastDataUpdate: Date | null;

  // Actions
  setShiftTarget: (target: number) => void;
  setDayTarget: (target: number) => void;
  setAdjustedOreRate: (rate: number) => void;
  setUncertaintyLevel: (level: 1 | 2 | 3) => void;
  setSelectedMills: (mills: string[]) => void;

  // Update from real-time data
  updateRealTimeData: (data: {
    currentOreRate: number;
    actualShiftProduction: number;
    actualDayProduction: number;
    activeMillsCount: number;
  }) => void;

  toggleRealTimeMode: () => void;
  resetToDefaults: () => void;
}

export const useForecastingStore = create<ForecastingSettings>((set) => ({
  // Initial values
  shiftTarget: 1400,
  dayTarget: 4000,
  adjustedOreRate: 169.67,
  uncertaintyLevel: 2,
  selectedMills: [],

  currentOreRate: 169.67,
  actualShiftProduction: 0,
  actualDayProduction: 0,
  activeMillsCount: 0,

  isRealTimeMode: true,
  lastDataUpdate: null,

  // Actions
  setShiftTarget: (target) => set({ shiftTarget: target }),
  setDayTarget: (target) => set({ dayTarget: target }),
  setAdjustedOreRate: (rate) => set({ adjustedOreRate: rate }),
  setUncertaintyLevel: (level) => set({ uncertaintyLevel: level }),
  setSelectedMills: (mills) => set({ selectedMills: mills }),

  updateRealTimeData: (data) =>
    set({
      currentOreRate: data.currentOreRate,
      actualShiftProduction: data.actualShiftProduction,
      actualDayProduction: data.actualDayProduction,
      activeMillsCount: data.activeMillsCount,
      lastDataUpdate: new Date(),
    }),

  toggleRealTimeMode: () =>
    set((state) => ({
      isRealTimeMode: !state.isRealTimeMode,
    })),

  resetToDefaults: () =>
    set({
      shiftTarget: 1400,
      dayTarget: 4000,
      adjustedOreRate: 169.67,
      uncertaintyLevel: 2,
    }),
}));
```

### 3. Enhanced useProductionForecast Hook

**File:** `src/app/mills-forecasting/hooks/useProductionForecast.ts` (modified)

```typescript
export const useProductionForecast = (args: UseProductionForecastArgs) => {
  const {
    shiftTarget,
    dayTarget,
    currentOreRate, // Now from real-time data
    adjustedOreRate,
    uncertaintyLevel,
    mills,
    selectedMills,
    actualShiftProduction, // NEW: from real-time data
    actualDayProduction, // NEW: from real-time data
  } = args;

  // ... existing logic, but now uses actual production data

  // Instead of calculating productionSoFar from assumptions:
  const productionSoFar = actualShiftProduction; // Use real data
  const productionToday = actualDayProduction; // Use real data

  // Rest of forecast calculations remain the same
};
```

### 4. Updated Page Component

**File:** `src/app/mills-forecasting/page.tsx` (modified)

```typescript
"use client";

import { useEffect } from "react";
import { useForecastingStore } from "./stores/forecastingStore";
import { useMillsProductionData } from "./hooks/useMillsProductionData";
import { useProductionForecast } from "./hooks/useProductionForecast";

export default function MillsForecastingPage() {
  // Zustand store for settings
  const {
    shiftTarget,
    dayTarget,
    currentOreRate,
    adjustedOreRate,
    uncertaintyLevel,
    selectedMills,
    actualShiftProduction,
    actualDayProduction,
    isRealTimeMode,
    updateRealTimeData,
    setShiftTarget,
    setDayTarget,
    setAdjustedOreRate,
    setUncertaintyLevel,
    setSelectedMills,
  } = useForecastingStore();

  // Real-time data from API
  const { data: productionData, isLoading } = useMillsProductionData(20);

  // Update store when real-time data arrives
  useEffect(() => {
    if (productionData && isRealTimeMode) {
      updateRealTimeData({
        currentOreRate: productionData.totalOreRate,
        actualShiftProduction: productionData.shiftProduction,
        actualDayProduction: productionData.dayProduction,
        activeMillsCount: productionData.activeMillsCount,
      });
    }
  }, [productionData, isRealTimeMode, updateRealTimeData]);

  // Forecast calculations
  const { currentTime, forecast } = useProductionForecast({
    shiftTarget,
    dayTarget,
    currentOreRate, // From real-time data
    adjustedOreRate,
    uncertaintyLevel,
    mills: MILLS_LIST,
    selectedMills,
    actualShiftProduction, // NEW: from real-time data
    actualDayProduction, // NEW: from real-time data
  });

  if (isLoading || !forecast) {
    return <LoadingState />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      <MillsForecastingHeader
        currentTime={currentTime}
        forecast={forecast}
        isRealTimeMode={isRealTimeMode}
      />

      {/* Rest of UI */}
    </div>
  );
}
```

## Implementation Plan

### Phase 1: Create Data Layer (Week 1)

1. ✅ Create `useMillsProductionData` hook
2. ✅ Create `useMillsProductionTrends` hook
3. ✅ Test API integration with existing endpoints

### Phase 2: Create State Management (Week 1)

1. ✅ Create `forecastingStore.ts` with Zustand
2. ✅ Define interfaces and types
3. ✅ Implement all actions and state updates

### Phase 3: Integration (Week 2)

1. ✅ Update `useProductionForecast` to accept real-time data
2. ✅ Modify page component to use store + hooks
3. ✅ Update all child components to use store values

### Phase 4: UI Enhancements (Week 2)

1. ✅ Add real-time data indicator
2. ✅ Add manual/auto mode toggle
3. ✅ Add data refresh controls
4. ✅ Add error handling and loading states

### Phase 5: Testing & Refinement (Week 3)

1. ✅ Test with real production data
2. ✅ Verify forecast accuracy
3. ✅ Performance optimization
4. ✅ Documentation

## Benefits

### 1. Clean Architecture

- **Separation of concerns**: Data fetching, state management, and UI are separate
- **Reusable hooks**: Can be used in other parts of the application
- **Type safety**: Full TypeScript support throughout

### 2. Real-Time Integration

- **Automatic updates**: Data refreshes every 20 seconds
- **Accurate forecasts**: Based on actual production data, not assumptions
- **Live monitoring**: Users see real production status

### 3. Maintainability

- **Follows existing patterns**: Similar to MillsPage implementation
- **Centralized state**: Easy to debug and extend
- **Clear data flow**: API → Hooks → Store → UI

### 4. User Experience

- **Accurate data**: Real production values instead of manual input
- **Flexibility**: Users can still override with adjusted rates
- **Transparency**: Clear indication of real-time vs manual mode

## API Requirements

### Existing Endpoints (Already Available)

- ✅ `/api/mills/ore-by-mill` - Current mill data
- ✅ `/api/mills/trend-by-tag` - Historical trends
- ✅ `/api/mills/all_mills_by_param` - Multi-mill historical data

### Potential New Endpoints (Optional)

- `/api/mills/production-summary` - Aggregated production data for all mills
- `/api/mills/shift-totals` - Current shift production totals

## File Structure

```
src/app/mills-forecasting/
├── hooks/
│   ├── useMillsProductionData.ts      (NEW)
│   ├── useMillsProductionTrends.ts    (NEW)
│   └── useProductionForecast.ts       (MODIFIED)
├── stores/
│   └── forecastingStore.ts            (NEW)
├── types/
│   ├── forecasting.ts                 (EXISTING)
│   └── production.ts                  (NEW)
├── components/
│   └── ... (existing components)
└── page.tsx                           (MODIFIED)
```

## Migration Strategy

### Step 1: Add New Infrastructure (No Breaking Changes)

- Create new hooks and store
- Keep existing code working

### Step 2: Gradual Integration

- Update page component to use new hooks
- Keep fallback to manual mode

### Step 3: Component Updates

- Update child components one by one
- Test each component thoroughly

### Step 4: Cleanup

- Remove old manual input code
- Update documentation

## Conclusion

This proposal provides a clean, maintainable solution that:

- ✅ Follows proven patterns from MillsPage
- ✅ Integrates real-time production data
- ✅ Maintains flexibility for user adjustments
- ✅ Ensures type safety and code quality
- ✅ Enables future enhancements

The architecture is scalable and can easily accommodate additional features like:

- Historical forecast accuracy tracking
- Advanced analytics and reporting
- Multi-shift planning
- Integration with other systems
