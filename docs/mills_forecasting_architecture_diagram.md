# Mills Forecasting Architecture Diagram

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND API LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  /api/mills/ore-by-mill          ← Current mill data (shift totals)     │
│  /api/mills/trend-by-tag         ← Historical trends                    │
│  /api/mills/all_mills_by_param   ← Multi-mill historical data           │
│                                                                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ HTTP Requests (20s refresh)
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                     REACT QUERY HOOKS LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  useMillsProductionData()                                                │
│  ├─ Fetches all mills data in parallel                                  │
│  ├─ Aggregates total ore rate                                           │
│  ├─ Calculates shift/day production                                     │
│  └─ Returns: { mills, totalOreRate, shiftProduction, ... }              │
│                                                                           │
│  useMillsProductionTrends()                                              │
│  ├─ Fetches historical trends (last N hours)                            │
│  ├─ Resamples to 5min intervals                                         │
│  └─ Returns: TrendDataPoint[]                                           │
│                                                                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ Data Updates
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                      ZUSTAND STATE STORE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  STATE:                                                                  │
│  ├─ User Settings:                                                       │
│  │  ├─ shiftTarget: 1400                                                │
│  │  ├─ dayTarget: 4000                                                  │
│  │  ├─ adjustedOreRate: 169.67                                          │
│  │  ├─ uncertaintyLevel: 2                                              │
│  │  └─ selectedMills: []                                                │
│  │                                                                       │
│  └─ Real-Time Data:                                                      │
│     ├─ currentOreRate: 165.3  ← FROM API                                │
│     ├─ actualShiftProduction: 1234.5  ← FROM API                        │
│     ├─ actualDayProduction: 3456.7  ← FROM API                          │
│     └─ lastDataUpdate: Date                                             │
│                                                                           │
│  ACTIONS:                                                                │
│  ├─ setShiftTarget()                                                     │
│  ├─ setAdjustedOreRate()                                                 │
│  ├─ updateRealTimeData()  ← Called when API data arrives                │
│  └─ toggleRealTimeMode()                                                 │
│                                                                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ State Access
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                    FORECAST CALCULATION HOOK                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  useProductionForecast({                                                 │
│    currentOreRate,          ← FROM STORE (real-time)                    │
│    adjustedOreRate,         ← FROM STORE (user setting)                 │
│    actualShiftProduction,   ← FROM STORE (real-time)                    │
│    actualDayProduction,     ← FROM STORE (real-time)                    │
│    ...                                                                   │
│  })                                                                      │
│                                                                           │
│  CALCULATIONS:                                                           │
│  ├─ Time remaining in shift/day                                         │
│  ├─ Production so far (uses ACTUAL data)                                │
│  ├─ Forecast scenarios (optimistic/expected/pessimistic)                │
│  ├─ Required rates to meet targets                                      │
│  ├─ Per-mill setpoints                                                   │
│  └─ Hourly forecast timeline                                            │
│                                                                           │
│  RETURNS: { currentTime, forecast }                                     │
│                                                                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ Forecast Data
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                         UI COMPONENTS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  MillsForecastingPage                                                    │
│  ├─ MillsForecastingHeader                                              │
│  │  ├─ Shows current time & shift                                       │
│  │  ├─ Displays actual production vs targets                            │
│  │  └─ Real-time indicator badge                                        │
│  │                                                                       │
│  ├─ MillsSelector                                                        │
│  │  └─ Select which mills to include in forecast                        │
│  │                                                                       │
│  └─ ForecastLayout                                                       │
│     ├─ ProgressSummaryCards                                             │
│     │  ├─ Shift Progress (actual vs target)                             │
│     │  └─ Day Progress (actual vs target)                               │
│     │                                                                    │
│     ├─ ProductionForecastChart                                           │
│     │  └─ Hourly forecast timeline (3 scenarios)                        │
│     │                                                                    │
│     ├─ PerMillOreSetpointChart                                           │
│     │  └─ Required rates per mill                                       │
│     │                                                                    │
│     └─ Control Panels                                                    │
│        ├─ TargetControlPanel (shift/day targets)                        │
│        ├─ OreRateControlPanel (current/adjusted rates)                  │
│        └─ UncertaintyControlPanel (uncertainty level)                   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Comparison: Current vs Proposed

### Current Architecture (Manual Mode)

```
┌──────────────┐
│ User Input   │
│ (Manual)     │
└──────┬───────┘
       │
       │ Hardcoded values
       │ currentOreRate = 169.67
       │
┌──────▼────────────────┐
│ useProductionForecast │
│ (Calculations)        │
└──────┬────────────────┘
       │
       │ Forecast based on assumptions
       │
┌──────▼───────┐
│ UI Display   │
└──────────────┘
```

### Proposed Architecture (Real-Time Mode)

```
┌──────────────┐         ┌─────────────────┐
│ Backend API  │────────▶│ React Query     │
│ (Real Data)  │  20s    │ Hooks           │
└──────────────┘         └────────┬────────┘
                                  │
                                  │ Auto-update
                                  │
                         ┌────────▼────────┐
                         │ Zustand Store   │
                         │ (State Mgmt)    │
                         └────────┬────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
┌──────▼───────┐      ┌───────────▼──────────┐    ┌─────────▼────────┐
│ User Input   │      │ Real-Time Data       │    │ Forecast Hook    │
│ (Settings)   │      │ (Actual Production)  │    │ (Calculations)   │
└──────────────┘      └──────────────────────┘    └─────────┬────────┘
                                                             │
                                                             │
                                                   ┌─────────▼────────┐
                                                   │ UI Display       │
                                                   │ (Accurate Data)  │
                                                   └──────────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FORECASTING STORE STATE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────┐         ┌──────────────────────┐        │
│  │  USER SETTINGS     │         │  REAL-TIME DATA      │        │
│  │  (Adjustable)      │         │  (Auto-updated)      │        │
│  ├────────────────────┤         ├──────────────────────┤        │
│  │ shiftTarget        │         │ currentOreRate       │        │
│  │ dayTarget          │         │ actualShiftProd      │        │
│  │ adjustedOreRate    │         │ actualDayProd        │        │
│  │ uncertaintyLevel   │         │ activeMillsCount     │        │
│  │ selectedMills      │         │ lastDataUpdate       │        │
│  └────────────────────┘         └──────────────────────┘        │
│           │                              ▲                       │
│           │                              │                       │
│           │                              │                       │
│  ┌────────▼──────────────────────────────┴────────┐             │
│  │         FORECAST CALCULATIONS                  │             │
│  │  (Combines user settings + real-time data)     │             │
│  └────────────────────────────────────────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
MillsForecastingPage
│
├─ useMillsProductionData() ──────┐
│                                  │
├─ useForecastingStore() ─────────┼─── Data Sources
│                                  │
└─ useProductionForecast() ───────┘
   │
   ├─ MillsForecastingHeader
   │  ├─ Current Time Display
   │  ├─ Shift Info Badge
   │  ├─ Real-Time Indicator
   │  └─ Production Summary
   │
   ├─ MillsSelector
   │  └─ Mill Selection Buttons
   │
   └─ ForecastLayout
      │
      ├─ Left Column
      │  ├─ ProgressSummaryCards
      │  │  ├─ Shift Progress Card
      │  │  └─ Day Progress Card
      │  │
      │  ├─ RequiredRatesCard
      │  │
      │  └─ Control Panels
      │     ├─ TargetControlPanel
      │     ├─ OreRateControlPanel
      │     └─ UncertaintyControlPanel
      │
      └─ Right Column
         ├─ ProductionForecastChart
         ├─ ShiftPerformanceChart
         └─ PerMillOreSetpointChart
```

## Data Update Cycle

```
1. API Fetch (Every 20s)
   ↓
2. React Query Cache Update
   ↓
3. useEffect Detects New Data
   ↓
4. Store.updateRealTimeData() Called
   ↓
5. Store State Updated
   ↓
6. Components Re-render (Automatic)
   ↓
7. useProductionForecast Recalculates
   ↓
8. UI Shows Updated Forecast
   ↓
   [Wait 20s]
   ↓
   Back to Step 1
```

## Error Handling Flow

```
API Request
   │
   ├─ Success ──────────────┐
   │                        │
   │                   Update Store
   │                        │
   │                   Show Data
   │
   └─ Error ────────────────┐
                            │
                       Retry (3x)
                            │
                            ├─ Success ──────┐
                            │                │
                            │           Update Store
                            │
                            └─ Final Failure ─────┐
                                                   │
                                              Show Error
                                                   │
                                              Fallback to
                                              Manual Mode
```

## Real-Time vs Manual Mode Toggle

```
┌─────────────────────────────────────────────────────────────┐
│                    MODE TOGGLE SWITCH                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  REAL-TIME MODE (Default)                                    │
│  ├─ currentOreRate ← FROM API                                │
│  ├─ actualShiftProduction ← FROM API                         │
│  ├─ actualDayProduction ← FROM API                           │
│  ├─ Auto-refresh every 20s                                   │
│  └─ Green indicator badge                                    │
│                                                               │
│  ─────────────────────────────────────────────────           │
│                                                               │
│  MANUAL MODE (Override)                                      │
│  ├─ currentOreRate ← USER INPUT                              │
│  ├─ actualShiftProduction ← CALCULATED                       │
│  ├─ actualDayProduction ← CALCULATED                         │
│  ├─ No auto-refresh                                          │
│  └─ Orange indicator badge                                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Benefits Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE BENEFITS                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ CLEAN SEPARATION OF CONCERNS                             │
│     ├─ Data fetching (React Query)                           │
│     ├─ State management (Zustand)                            │
│     ├─ Business logic (Hooks)                                │
│     └─ Presentation (Components)                             │
│                                                               │
│  ✅ TYPE SAFETY                                              │
│     └─ Full TypeScript support throughout                    │
│                                                               │
│  ✅ REAL-TIME ACCURACY                                       │
│     ├─ Actual production data                                │
│     ├─ Auto-refresh every 20s                                │
│     └─ No manual data entry errors                           │
│                                                               │
│  ✅ MAINTAINABILITY                                          │
│     ├─ Follows proven patterns                               │
│     ├─ Easy to test                                          │
│     └─ Clear data flow                                       │
│                                                               │
│  ✅ FLEXIBILITY                                              │
│     ├─ Real-time or manual mode                              │
│     ├─ User can override settings                            │
│     └─ Extensible architecture                               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```
