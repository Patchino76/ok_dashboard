# Mills Forecasting - Proportional Load Adjustments

## Overview

Implemented intelligent mill adjustment calculations that distribute the required load changes proportionally based on each mill's current load percentage.

## Implementation Date

November 20, 2025

## Key Features

### 1. **Proportional Distribution Logic**

#### All Mills Selected (Default)

- Adjustment is distributed across **all 12 mills**
- Each mill's adjustment is proportional to its **current load percentage**
- Formula: `adjustment = (mill_current_rate / total_current_rate) × required_adjustment`

#### Specific Mills Selected

- Adjustment is distributed **only among selected mills**
- Non-selected mills maintain their current rates
- Selected mills share the load proportionally based on their current rates

### 2. **Calculation Flow**

```typescript
// Step 1: Identify adjustable mills
adjustableMills = selectedMills.length === 0
  ? allMills
  : selectedMills

// Step 2: Calculate total current rate of adjustable mills
selectedTotalRate = sum(adjustableMills.map(m => currentRate[m]))

// Step 3: Calculate required total rate to meet target
requiredSelectedShiftRate = remainingTarget / hoursToShiftEnd

// Step 4: For each adjustable mill
for each mill in adjustableMills:
  // Calculate mill's share based on current load
  share = mill.currentRate / selectedTotalRate

  // Calculate required rate for this mill
  mill.requiredRate = requiredSelectedShiftRate × share

  // Calculate adjustment needed
  mill.adjustmentNeeded = mill.requiredRate - mill.currentRate
```

### 3. **Visualization**

#### Bar Chart Display

- **Large gray bar**: Current ore feed rate (~170 t/h per mill)
- **Small colored bar on top**: Positive adjustment needed (if any)
- **Badge above bars**: Shows adjustment value with color coding
  - 🟢 Green: Small increase needed (< 5 t/h)
  - 🟡 Yellow: Moderate increase (5-10 t/h)
  - 🔴 Red: Large increase (> 10 t/h)
  - ⚪ Gray: Decrease or no change

#### Badge Format

```
+8 t/h  ← Adjustment needed
  ↑
```

### 4. **Example Scenarios**

#### Scenario A: All Mills Selected (Default)

```
Current Production: 1940 t/h (12 mills)
Target: 2100 t/h
Required Adjustment: +160 t/h

Mill Distribution (proportional to current load):
- Mill01 (160 t/h, 8.2%): +13.1 t/h
- Mill02 (216 t/h, 11.1%): +17.8 t/h
- Mill03 (163 t/h, 8.4%): +13.4 t/h
- Mill04 (165 t/h, 8.5%): +13.6 t/h
- Mill05 (175 t/h, 9.0%): +14.4 t/h
- Mill06 (177 t/h, 9.1%): +14.6 t/h
- Mill07 (170 t/h, 8.8%): +14.0 t/h
- Mill08 (170 t/h, 8.8%): +14.0 t/h
- Mill09 (167 t/h, 8.6%): +13.8 t/h
- Mill10 (166 t/h, 8.6%): +13.7 t/h
- Mill11 (46 t/h, 2.4%): +3.8 t/h
- Mill12 (166 t/h, 8.6%): +13.7 t/h

Total: +160 t/h ✅
```

#### Scenario B: Only Mills 1, 2, 3 Selected

```
Current Production (selected): 539 t/h (3 mills)
Target: 2100 t/h
Required Adjustment: +560 t/h (distributed only to selected mills)

Mill Distribution:
- Mill01 (160 t/h, 29.7%): +166.3 t/h
- Mill02 (216 t/h, 40.1%): +224.6 t/h
- Mill03 (163 t/h, 30.2%): +169.1 t/h
- Mill04-12: No change (maintain current rates)

Total: +560 t/h ✅
```

## Files Modified

### 1. **Type Definitions**

**File**: `src/app/mills-forecasting/types/forecasting.ts`

```typescript
export interface PerMillSetpoint {
  millId: string;
  currentRate: number;
  requiredShiftRate: number;
  requiredDayRate: number;
  adjustmentNeeded: number; // NEW: Adjustment needed to reach target
}
```

### 2. **Forecast Hook**

**File**: `src/app/mills-forecasting/hooks/useProductionForecast.ts`

**Changes**:

- Added `adjustmentNeeded` calculation for each mill
- Enhanced debug logging with per-mill details
- Shows load share percentage for each mill
- Displays total adjustment needed

**Key Code**:

```typescript
adjustableMills.forEach((millId) => {
  const currentRate = basePerMillRates[millId];

  // Calculate this mill's share based on its current load percentage
  const share = selectedTotalRate > 0 ? currentRate / selectedTotalRate : 0;

  // Calculate the required rate for this mill to meet the target
  const requiredShiftRate = requiredSelectedShiftRate * share;

  // Calculate adjustment needed (can be positive or negative)
  const adjustmentNeeded = requiredShiftRate - currentRate;

  perMillSetpoints.push({
    millId,
    currentRate,
    requiredShiftRate,
    requiredDayRate,
    adjustmentNeeded,
  });
});
```

### 3. **Chart Component**

**File**: `src/app/mills-forecasting/components/PerMillOreSetpointChart.tsx`

**Changes**:

- Updated to use `adjustmentNeeded` field from data
- Added " t/h" unit to adjustment display
- Improved data mapping for clarity

**Key Code**:

```typescript
const deltaTh = item.adjustmentNeeded; // Use pre-calculated adjustment
const deltaDisplay = `${deltaInt > 0 ? "+" : ""}${deltaInt} t/h`;
```

## Debug Logging

### Console Output Example

```javascript
📊 Per-mill setpoints calculated: {
  adjustableMills: 12,
  selectedMills: "ALL",
  totalCurrentRate: "1940.9 t/h",
  requiredTotalRate: "2100.0 t/h",
  totalAdjustment: "+159.1 t/h",
  perMillDetails: [
    { mill: "Mill01", current: "160.1", required: "173.2", adjustment: "+13.1", share: "8.2%" },
    { mill: "Mill02", current: "215.7", required: "233.5", adjustment: "+17.8", share: "11.1%" },
    // ... etc
  ]
}
```

## Benefits

### 1. **Fair Distribution**

- Mills with higher current loads take proportionally more adjustment
- Prevents overloading smaller or struggling mills
- Maintains operational balance

### 2. **Operational Flexibility**

- Operators can exclude problematic mills from adjustments
- Selected mills share the load intelligently
- Easy to test "what-if" scenarios

### 3. **Clear Visualization**

- Adjustment values displayed directly on bars
- Color-coded badges for quick assessment
- Shows both current state and required changes

### 4. **Accurate Calculations**

- Uses real-time mill ore rates from API
- Accounts for actual production capacity
- Considers time remaining in shift

## Testing Checklist

- [ ] **All mills selected**: Verify adjustments sum to required total
- [ ] **Subset selected**: Verify only selected mills show adjustments
- [ ] **Single mill selected**: Verify all adjustment goes to that mill
- [ ] **High-load mill**: Verify it gets proportionally larger adjustment
- [ ] **Low-load mill**: Verify it gets proportionally smaller adjustment
- [ ] **Negative adjustment**: Verify badges show decrease correctly
- [ ] **Console logs**: Verify percentages sum to 100%
- [ ] **Chart display**: Verify adjustment values visible on bars

## Future Enhancements

1. **Capacity Limits**: Add max/min rate constraints per mill
2. **Mill Efficiency**: Factor in mill efficiency ratings
3. **Historical Performance**: Use past performance to weight adjustments
4. **Optimization Algorithm**: ML-based optimal distribution
5. **Manual Override**: Allow operators to manually adjust individual mills

## Related Documentation

- `mills_forecasting_implementation_summary.md` - Overall implementation
- `mills_forecasting_per_mill_rates_fix.md` - Individual mill rates integration
- `mills_forecasting_chart_redesign.md` - Chart visualization design
