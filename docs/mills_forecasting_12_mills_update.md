# Mills Forecasting - 12 Mills Support Update

## Changes Summary

Updated the mills-forecasting application to support all **12 mills** instead of just 10.

---

## Files Modified

### 1. Constants Configuration

**File:** `src/app/mills-forecasting/constants.ts`

**Changes:**

- Updated `MILLS_LIST` to include all 12 mills from `millsNames`
- Changed from `millsNames.slice(0, 10)` to `millsNames.map()`
- Updated comment to reflect "All 12 mills"

**Before:**

```typescript
// First 10 mills only, with "all" option
export const MILLS_LIST = [
  "all",
  ...millsNames.slice(0, 10).map((mill) => mill.en),
] as const;
```

**After:**

```typescript
// All 12 mills, with "all" option
export const MILLS_LIST = [
  "all",
  ...millsNames.map((mill) => mill.en),
] as const;
```

---

### 2. Production Data Hook

**File:** `src/app/mills-forecasting/hooks/useMillsProductionData.ts`

**Changes:**

- Updated to fetch data for all 12 mills
- Changed from `millsNames.slice(0, 10)` to `millsNames.map()`
- Updated comment to reflect "all 12 mills"

**Before:**

```typescript
// Get mill names from the same source as MillsPage (first 10 mills only)
const millsList = millsNames.slice(0, 10).map((mill) => mill.en);
```

**After:**

```typescript
// Get mill names from the same source as MillsPage (all 12 mills)
const millsList = millsNames.map((mill) => mill.en);
```

---

### 3. Header Component

**File:** `src/app/mills-forecasting/components/MillsForecastingHeader.tsx`

**Changes:**

- Updated active mills display from "X / 10" to "X / 12"

**Before:**

```typescript
{activeMillsCount} / 10
```

**After:**

```typescript
{activeMillsCount} / 12
```

---

### 4. Mills Selector Component

**File:** `src/app/mills-forecasting/components/MillsSelector.tsx`

**Changes:**

- Fixed label formatting to handle correct mill format
- Changed from `mill.replace("Mill_", "M")` to `mill.replace("Mill", "M")`
- Now correctly displays "M01", "M02", etc. instead of "Mill01", "Mill02"

**Before:**

```typescript
const label = isAllButton ? "All" : mill.replace("Mill_", "M");
```

**After:**

```typescript
const label = isAllButton ? "All" : mill.replace("Mill", "M");
```

---

### 5. Per-Mill Setpoint Chart

**File:** `src/app/mills-forecasting/components/PerMillOreSetpointChart.tsx`

**Changes:**

- Fixed mill name formatting in chart labels
- Changed from `item.millId.replace("Mill_", "M")` to `item.millId.replace("Mill", "M")`
- Now correctly displays "M01", "M02", etc. in chart

**Before:**

```typescript
const name = item.millId.replace("Mill_", "M");
```

**After:**

```typescript
const name = item.millId.replace("Mill", "M");
```

---

## Impact

### ✅ Data Fetching

- Now fetches production data for all 12 mills
- API calls: 12 parallel requests instead of 10
- Aggregates data from all 12 mills

### ✅ UI Components

- Mill selector buttons: Shows all 12 mills (M01-M12)
- Header display: Shows "X / 12" for active mills
- Per-mill chart: Can display up to 12 bars

### ✅ Calculations

- Production totals include all 12 mills
- Ore rate aggregation includes all 12 mills
- Forecast calculations consider all 12 mills

---

## Mill List

The application now supports:

1. **Mill01** (M01)
2. **Mill02** (M02)
3. **Mill03** (M03)
4. **Mill04** (M04)
5. **Mill05** (M05)
6. **Mill06** (M06)
7. **Mill07** (M07)
8. **Mill08** (M08)
9. **Mill09** (M09)
10. **Mill10** (M10)
11. **Mill11** (M11)
12. **Mill12** (M12)

---

## Testing Checklist

### ✅ Mill Selector

- [ ] All 12 mill buttons visible (M01-M12)
- [ ] "All" button works correctly
- [ ] Individual mill selection works
- [ ] Multiple mill selection works

### ✅ Data Fetching

- [ ] 12 API calls in Network tab
- [ ] All mills data loads successfully
- [ ] Production totals include all 12 mills
- [ ] Active mills count accurate (X / 12)

### ✅ Charts

- [ ] Per-mill chart shows all selected mills
- [ ] Mill labels display correctly (M01-M12)
- [ ] Shift performance chart includes all mills data
- [ ] Ore feed timeline includes all mills

### ✅ Calculations

- [ ] Total ore rate = sum of all 12 mills
- [ ] Shift production = sum of all 12 mills
- [ ] Day production = sum of all 12 mills
- [ ] Forecasts accurate with 12 mills

---

## API Calls

With all 12 mills, the application now makes:

```
GET /api/mills/ore-by-mill?mill=Mill01
GET /api/mills/ore-by-mill?mill=Mill02
GET /api/mills/ore-by-mill?mill=Mill03
GET /api/mills/ore-by-mill?mill=Mill04
GET /api/mills/ore-by-mill?mill=Mill05
GET /api/mills/ore-by-mill?mill=Mill06
GET /api/mills/ore-by-mill?mill=Mill07
GET /api/mills/ore-by-mill?mill=Mill08
GET /api/mills/ore-by-mill?mill=Mill09
GET /api/mills/ore-by-mill?mill=Mill10
GET /api/mills/ore-by-mill?mill=Mill11
GET /api/mills/ore-by-mill?mill=Mill12
```

**Total:** 12 requests every 20 seconds

---

## Performance Considerations

### Network

- **Before:** 10 requests every 20 seconds
- **After:** 12 requests every 20 seconds
- **Impact:** +20% network calls (minimal)

### Data Processing

- **Before:** Aggregating 10 mills
- **After:** Aggregating 12 mills
- **Impact:** Negligible (simple sum operations)

### UI Rendering

- **Before:** Up to 10 mill buttons
- **After:** Up to 12 mill buttons
- **Impact:** Minimal (buttons are lightweight)

---

## Backward Compatibility

✅ **Fully backward compatible**

- Existing functionality unchanged
- Only extended to support more mills
- No breaking changes

---

## Related Updates

This update also includes:

- ✅ Correct mill naming format (Mill01 vs Mill_1)
- ✅ Increased target slider ranges (shift: 20,000, day: 60,000)
- ✅ Centralized mill names from `@/lib/tags/mills-tags`

---

**Status:** ✅ Complete and Ready for Testing  
**Date:** November 20, 2025
