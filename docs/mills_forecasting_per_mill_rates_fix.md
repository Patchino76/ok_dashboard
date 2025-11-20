# Mills Forecasting - Per-Mill Ore Rates Fix

## Issue Identified

The per-mill ore feed recommendations chart was showing incorrect values (~1.4974 t/h) instead of actual mill ore rates (typically 10-20 t/h per mill).

### Problem Screenshot

- Bar chart showed values around 1.4974 for all mills
- Current rates and recommendations were not displaying correctly
- Delta badges showed incorrect adjustments

---

## Root Cause

In `useProductionForecast.ts`, the code was incorrectly setting the same total ore rate for ALL mills:

```typescript
// ❌ INCORRECT CODE (line 171)
const basePerMillRates: Record<string, number> = {};
mills.forEach((millId) => {
  if (millId === "all") return;
  basePerMillRates[millId] = currentOreRate; // Using TOTAL rate for each mill!
});
```

This meant if total ore rate was 165 t/h and there were 12 mills, each mill was assigned 165 t/h instead of their individual rates (e.g., Mill01: 15.2 t/h, Mill02: 13.8 t/h, etc.).

The calculation then divided this incorrectly, resulting in the tiny values shown in the chart.

---

## Solution Implemented

### 1. Updated Type Definitions

**File:** `src/app/mills-forecasting/types/forecasting.ts`

Added `millOreRates` parameter to pass individual mill rates:

```typescript
export interface UseProductionForecastArgs {
  // ... existing fields
  // Individual mill ore rates (optional - will use equal distribution if not provided)
  millOreRates?: Record<string, number>;
}
```

---

### 2. Updated Forecast Hook

**File:** `src/app/mills-forecasting/hooks/useProductionForecast.ts`

**Changes:**

- Accept `millOreRates` parameter
- Use actual mill rates when available
- Fallback to equal distribution if not provided

```typescript
// ✅ CORRECT CODE
const basePerMillRates: Record<string, number> = {};
if (millOreRates) {
  // Use actual mill ore rates from production data
  mills.forEach((millId) => {
    if (millId === "all") return;
    basePerMillRates[millId] = millOreRates[millId] || 0;
  });
} else {
  // Fallback: distribute total ore rate equally among mills
  const millCount = mills.filter((m) => m !== "all").length;
  const ratePerMill = millCount > 0 ? currentOreRate / millCount : 0;
  mills.forEach((millId) => {
    if (millId === "all") return;
    basePerMillRates[millId] = ratePerMill;
  });
}
```

---

### 3. Updated Page Component

**File:** `src/app/mills-forecasting/page.tsx`

Created `millOreRates` map from production data and passed it to the forecast hook:

```typescript
// Create mill ore rates map from production data
const millOreRates = useMemo(() => {
  if (!productionData?.mills) return undefined;

  const rates: Record<string, number> = {};
  productionData.mills.forEach((mill) => {
    rates[mill.title] = mill.ore || 0;
  });
  return rates;
}, [productionData]);

// Pass to forecast hook
const { currentTime, forecast } = useProductionForecast({
  // ... other params
  millOreRates, // Individual mill ore rates from API
});
```

---

## Data Flow

```
1. API Response (/api/mills/ore-by-mill)
   ↓
   Each mill has individual ore rate:
   - Mill01: 15.2 t/h
   - Mill02: 13.8 t/h
   - Mill03: 14.5 t/h
   - etc.

2. useMillsProductionData Hook
   ↓
   Returns: { mills: [...], totalOreRate: 165.3, ... }

3. Page Component (useMemo)
   ↓
   Creates millOreRates map:
   {
     "Mill01": 15.2,
     "Mill02": 13.8,
     "Mill03": 14.5,
     ...
   }

4. useProductionForecast Hook
   ↓
   Uses individual rates for calculations:
   - basePerMillRates["Mill01"] = 15.2
   - basePerMillRates["Mill02"] = 13.8
   - etc.

5. Per-Mill Setpoints
   ↓
   Calculates recommendations based on actual rates:
   - Mill01: current 15.2 → required 16.8 (Δ +1.6)
   - Mill02: current 13.8 → required 15.2 (Δ +1.4)
   - etc.

6. Chart Display
   ↓
   Shows correct values in bars and badges
```

---

## Expected Results

### Before Fix

- ❌ All mills showed ~1.4974 t/h
- ❌ Recommendations were meaningless
- ❌ Delta badges showed incorrect values

### After Fix

- ✅ Each mill shows its actual ore rate (10-20 t/h)
- ✅ Recommendations are proportional to current rates
- ✅ Delta badges show realistic adjustments (+/- 1-5 t/h)

---

## Example Calculation

**Scenario:**

- Total target: 1400 tons for shift (8 hours)
- Required total rate: 175 t/h
- Current total rate: 165.3 t/h
- Need to increase: +9.7 t/h

**Mill01:**

- Current rate: 15.2 t/h
- Share of total: 15.2 / 165.3 = 9.2%
- Required increase: 9.7 \* 0.092 = 0.89 t/h
- Recommended rate: 15.2 + 0.89 = **16.1 t/h**
- Delta badge: **↑ +1** (green)

**Mill02:**

- Current rate: 13.8 t/h
- Share of total: 13.8 / 165.3 = 8.3%
- Required increase: 9.7 \* 0.083 = 0.81 t/h
- Recommended rate: 13.8 + 0.81 = **14.6 t/h**
- Delta badge: **↑ +1** (green)

---

## Files Modified

1. ✅ `types/forecasting.ts` - Added `millOreRates` parameter
2. ✅ `hooks/useProductionForecast.ts` - Use individual mill rates
3. ✅ `page.tsx` - Create and pass mill rates map

---

## Testing Checklist

### ✅ Data Accuracy

- [ ] Each mill shows its actual ore rate from API
- [ ] Rates match values in MillsPage
- [ ] Total of all mills equals total ore rate

### ✅ Chart Display

- [ ] Bar heights represent actual ore rates (10-20 t/h range)
- [ ] Current values shown inside bars are correct
- [ ] Recommended values (bar tops) are reasonable

### ✅ Delta Badges

- [ ] Green badges (↑) for mills that need to increase
- [ ] Red badges (↓) for mills that need to decrease
- [ ] Yellow badges (→) for mills with minimal change
- [ ] Delta values are realistic (+/- 1-5 t/h)

### ✅ Calculations

- [ ] Sum of recommended rates meets target
- [ ] Proportional distribution based on current rates
- [ ] Selected mills get adjusted, others stay fixed

---

## Backward Compatibility

✅ **Fully backward compatible**

- If `millOreRates` not provided, falls back to equal distribution
- Existing functionality unchanged
- No breaking changes

---

## Related Data Structure

### MillInfoProps (from API)

```typescript
interface MillInfoProps {
  title: string; // "Mill01", "Mill02", etc.
  state: boolean; // true if running
  ore: number; // Current ore rate (t/h)
  shift1: number; // Shift 1 production (tons)
  shift2: number; // Shift 2 production (tons)
  shift3: number; // Shift 3 production (tons)
  total: number; // Total day production (tons)
}
```

### millOreRates Map

```typescript
{
  "Mill01": 15.2,
  "Mill02": 13.8,
  "Mill03": 14.5,
  "Mill04": 0,      // Stopped
  "Mill05": 16.1,
  "Mill06": 13.2,
  "Mill07": 15.8,
  "Mill08": 14.9,
  "Mill09": 15.3,
  "Mill10": 14.7,
  "Mill11": 15.6,
  "Mill12": 16.2
}
```

---

**Status:** ✅ Fixed and Ready for Testing  
**Date:** November 20, 2025

**Impact:** Critical fix for per-mill recommendations accuracy
