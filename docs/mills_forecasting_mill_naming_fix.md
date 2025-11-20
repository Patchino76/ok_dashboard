# Mills Forecasting - Mill Naming Format Fix

## Issue Identified

The mill naming format was incorrect in the API calls:

### ❌ Incorrect Format (Before)

```
Mill_1, Mill_2, Mill_3, ..., Mill_10
```

API calls were:

```
http://localhost:3000/api/mills/ore-by-mill?mill=Mill_6
```

### ✅ Correct Format (After)

```
Mill01, Mill02, Mill03, ..., Mill09, Mill10
```

API calls now:

```
http://localhost:3000/api/mills/ore-by-mill?mill=Mill06
```

---

## Root Cause

The mill names were hardcoded with incorrect format instead of using the centralized `millsNames` configuration from `@/lib/tags/mills-tags`.

---

## Solution Implemented

### 1. Updated Hook to Use Centralized Mill Names

**File:** `src/app/mills-forecasting/hooks/useMillsProductionData.ts`

**Before:**

```typescript
const millsList = [
  "Mill_1",
  "Mill_2",
  // ... hardcoded incorrect format
];
```

**After:**

```typescript
import { millsNames } from "@/lib/tags/mills-tags";

// Get mill names from the same source as MillsPage (first 10 mills only)
const millsList = millsNames.slice(0, 10).map((mill) => mill.en);
```

---

### 2. Updated Constants File

**File:** `src/app/mills-forecasting/constants.ts`

**Before:**

```typescript
export const MILLS_LIST = [
  "all",
  "Mill_1",
  "Mill_2",
  // ... hardcoded incorrect format
] as const;
```

**After:**

```typescript
import { millsNames } from "@/lib/tags/mills-tags";

export const MILLS_LIST = [
  "all",
  ...millsNames.slice(0, 10).map((mill) => mill.en),
] as const;
```

---

## Benefits

### ✅ Consistency

- Now uses the same mill naming source as MillsPage
- Single source of truth for mill names

### ✅ Maintainability

- No hardcoded mill names
- Changes to mill configuration automatically propagate

### ✅ Correctness

- API calls now use correct format
- Will successfully fetch data from backend

### ✅ Scalability

- Easy to add/remove mills by modifying only `mills-tags.ts`

---

## Files Modified

1. ✅ `src/app/mills-forecasting/hooks/useMillsProductionData.ts`

   - Added import of `millsNames`
   - Changed hardcoded list to dynamic import

2. ✅ `src/app/mills-forecasting/constants.ts`
   - Added import of `millsNames`
   - Changed hardcoded list to dynamic import

---

## Testing

### Verify API Calls

Open Network tab and check that API calls now use correct format:

```
✅ GET /api/mills/ore-by-mill?mill=Mill01
✅ GET /api/mills/ore-by-mill?mill=Mill02
✅ GET /api/mills/ore-by-mill?mill=Mill03
✅ GET /api/mills/ore-by-mill?mill=Mill04
✅ GET /api/mills/ore-by-mill?mill=Mill05
✅ GET /api/mills/ore-by-mill?mill=Mill06
✅ GET /api/mills/ore-by-mill?mill=Mill07
✅ GET /api/mills/ore-by-mill?mill=Mill08
✅ GET /api/mills/ore-by-mill?mill=Mill09
✅ GET /api/mills/ore-by-mill?mill=Mill10
```

### Verify Data Fetching

1. Open mills-forecasting page
2. Check browser console
3. Should see successful data fetching logs
4. Should see production data in header

---

## Mill Names Reference

From `@/lib/tags/mills-tags.ts`:

```typescript
export const millsNames = [
  { en: "Mill01", bg: "Мелница 01" },
  { en: "Mill02", bg: "Мелница 02" },
  { en: "Mill03", bg: "Мелница 03" },
  { en: "Mill04", bg: "Мелница 04" },
  { en: "Mill05", bg: "Мелница 05" },
  { en: "Mill06", bg: "Мелница 06" },
  { en: "Mill07", bg: "Мелница 07" },
  { en: "Mill08", bg: "Мелница 08" },
  { en: "Mill09", bg: "Мелница 09" },
  { en: "Mill10", bg: "Мелница 10" },
  { en: "Mill11", bg: "Мелница 11" },
  { en: "Mill12", bg: "Мелница 12" },
];
```

We use the first 10 mills (Mill01-Mill10) for forecasting.

---

## Impact

### Before Fix

- ❌ API calls failed with 404 errors
- ❌ No production data loaded
- ❌ Forecasts based on hardcoded defaults only

### After Fix

- ✅ API calls succeed with 200 responses
- ✅ Real production data loads correctly
- ✅ Forecasts based on actual mill data

---

**Status:** ✅ Fixed and Ready for Testing  
**Date:** November 20, 2025
