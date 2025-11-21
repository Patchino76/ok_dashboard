# Mills Forecasting - Inverted Selection Logic

## Overview

Implemented inverted mill selection logic where **selected mills are EXCLUDED** from target adjustments.

## Implementation Date

November 21, 2025

## 🔄 **New Selection Behavior**

### **Previous Logic (OLD)**

- ✅ Selected = Included in adjustments
- ❌ Unselected = Excluded (fixed at current rate)
- All unselected = All mills receive adjustments

### **New Logic (CURRENT)**

- ❌ **Selected (Gray)** = **EXCLUDED** from adjustments (fixed at current rate)
- ✅ **Unselected (Dark)** = **INCLUDED** in adjustments (receives SP recommendations)
- All unselected = All mills receive adjustments

## 📋 **Key Concepts**

### **Fixed Mills (Selected/Gray)**

- **Do NOT receive adjustment recommendations**
- Maintain their current ore feed rate (PV)
- Their current production **IS included** in overall calculations
- Shown with **gray bars** in chart
- No adjustment label displayed

### **Adjustable Mills (Unselected/Dark)**

- **DO receive adjustment recommendations**
- Get proportional share of required adjustment
- Shown with **dark slate bars** in chart
- Colored adjustment segments (green/orange/red)
- Adjustment labels displayed on top

## 🎨 **Visual Indicators**

### **Chart Display**

```
Fixed Mill (Selected):
┌─────────┐
│         │
│  Gray   │  ← Gray bar (#94a3b8)
│   Bar   │
│   160   │  ← Current value only
│         │
└─────────┘
    M11

Adjustable Mill (Unselected):
   +24 t/h     ← Adjustment label
┌─────────┐
│ Orange  │   ← Colored adjustment
├─────────┤
│  Dark   │   ← Dark slate bar (#475569)
│  Slate  │
│   160   │   ← Current value
└─────────┘
    M01
```

## 💻 **Implementation Details**

### **1. Forecast Hook Changes**

**File**: `src/app/mills-forecasting/hooks/useProductionForecast.ts`

**Logic Inversion** (lines 228-238):

```typescript
// NEW LOGIC: selectedMills are EXCLUDED from adjustment (fixed).
// If empty, all mills are adjustable.
const fixedMills =
  selectedMills.length === 0
    ? [] // No mills fixed, all adjustable
    : selectedMills.filter((m) => m in basePerMillRates);

// Adjustable mills are those NOT in the fixed list
const adjustableMills = Object.keys(basePerMillRates).filter(
  (m) => !fixedMills.includes(m)
);
```

**Include Fixed Mills in Output** (lines 295-306):

```typescript
// Add fixed mills with zero adjustment (excluded from optimization)
fixedMills.forEach((millId) => {
  const currentRate = basePerMillRates[millId];

  perMillSetpoints.push({
    millId,
    currentRate,
    requiredShiftRate: currentRate, // Keep at current rate
    requiredDayRate: currentRate, // Keep at current rate
    adjustmentNeeded: 0, // No adjustment for fixed mills
  });
});
```

### **2. Chart Component Changes**

**File**: `src/app/mills-forecasting/components/PerMillOreSetpointChart.tsx`

**Added isFixed Flag** (lines 24, 52, 60):

```typescript
interface ChartPoint {
  // ... other fields
  isFixed: boolean; // True if mill is excluded from adjustments
}

// In data mapping:
const isFixed = adjustment === 0; // Fixed mills have zero adjustment
```

**Conditional Bar Coloring** (lines 148-164):

```typescript
<Bar dataKey="current" stackId="a" barSize={50}>
  {chartData.map((entry, index) => (
    <Cell
      key={`current-${index}`}
      fill={entry.isFixed ? "#94a3b8" : "#475569"} // Gray for fixed, dark slate for adjustable
    />
  ))}
  <LabelList
    dataKey="currentDisplay"
    position="center"
    style={{ fill: "white", fontSize: 13, fontWeight: 600 }}
  />
</Bar>
```

**No Labels for Fixed Mills** (line 62):

```typescript
adjustmentDisplay: isFixed ? "" : getAdjustmentLabel(adjustment),
```

### **3. Debug Logging**

Enhanced console output shows:

```javascript
📊 Per-mill setpoints calculated: {
  adjustableMills: 11,
  fixedMills: 1,
  selectedForExclusion: "Mill11", // Mills excluded from adjustments
  totalCurrentRate: "1856.9 t/h",
  requiredTotalRate: "2100.0 t/h",
  totalAdjustment: "+243.1 t/h",
  perMillDetails: [...]
}
```

## 📊 **Example Scenarios**

### **Scenario A: Mill11 Selected (Excluded)**

```
User Action: Click Mill11 → Turns gray
Result:
- Mill11: Fixed at 84 t/h (no adjustment)
- Mills 1-10, 12: Share +243 t/h adjustment proportionally
- Mill11 production still counts toward target
```

### **Scenario B: Mills 1, 2, 3 Selected (Excluded)**

```
User Action: Click Mills 1, 2, 3 → Turn gray
Result:
- Mills 1, 2, 3: Fixed at current rates (no adjustments)
- Mills 4-12: Share adjustment proportionally
- Fixed mills' production still counts toward target
```

### **Scenario C: No Mills Selected (All Adjustable)**

```
User Action: No selections
Result:
- All 12 mills: Receive proportional adjustments
- Standard behavior - all mills participate
```

## 🎯 **Benefits**

### **1. Operational Flexibility**

- Exclude problematic mills from adjustments
- Protect mills undergoing maintenance
- Lock specific mills at desired rates

### **2. Clear Visual Feedback**

- Gray bars immediately show excluded mills
- No confusion about which mills are adjustable
- Adjustment labels only on active mills

### **3. Accurate Calculations**

- Fixed mills' production included in totals
- Remaining target distributed to adjustable mills only
- Proportional distribution based on current loads

## 🧪 **Testing Checklist**

- [ ] **No selection**: All mills show dark bars with adjustments
- [ ] **Single mill selected**: Selected mill turns gray, others get larger adjustments
- [ ] **Multiple mills selected**: All selected mills gray, remaining share adjustments
- [ ] **All mills selected**: All gray, no adjustments (edge case)
- [ ] **Select/deselect toggle**: Colors update correctly
- [ ] **Tooltip on gray mill**: Shows "Корекция: " with no value or "0 t/h"
- [ ] **Console logs**: Show correct fixed/adjustable counts
- [ ] **Target calculations**: Fixed mills' production counted in totals

## 🔍 **User Workflow**

1. **View all mills** with dark bars and adjustments
2. **Click a mill** to exclude it from adjustments
   - Mill bar turns **gray**
   - Adjustment label disappears
   - Other mills' adjustments **increase** to compensate
3. **Click again** to include it back
   - Mill bar turns **dark slate**
   - Adjustment label reappears
   - Adjustments redistribute across all active mills

## 📝 **Notes**

- Selection state managed by parent component
- Chart receives all mills (both fixed and adjustable)
- Zero adjustment (`adjustmentNeeded === 0`) identifies fixed mills
- Gray color (#94a3b8) chosen for clear visual distinction
- Tooltip still shows current rate for fixed mills

## 🚀 **Future Enhancements**

1. **Visual indicator on mill selector**: Show which mills are excluded
2. **Bulk selection**: "Exclude all" / "Include all" buttons
3. **Mill status reasons**: Add notes why a mill is excluded
4. **Historical exclusions**: Track which mills are frequently excluded
5. **Capacity limits**: Prevent adjustments beyond mill capacity
