# Mills Forecasting - Per-Mill Chart Redesign

## Issue Clarified

The chart was misunderstood. It should show:

1. **Large bars** (~170 t/h) = Current ore rates from API
2. **Small bars on top** (±10 t/h max) = Adjustments needed to meet target

---

## Chart Design

### Visual Structure

```
┌─────────────────────────────────────┐
│  ↑ +2  (green badge)                │
│ ┌───┐  ← Small adjustment bar       │
│ │ + │     (green/yellow/red)        │
│ ├───┤                                │
│ │   │                                │
│ │170│  ← Large current rate bar     │
│ │   │     (gray, ~170 t/h)          │
│ └───┘                                │
│  M01                                 │
└─────────────────────────────────────┘
```

### Stacked Bars

- **Bottom bar (large)**: Current ore rate from API
  - Color: Gray (#64748b)
  - Height: ~170 t/h (actual mill rate)
  - Label: Shows current value inside bar
- **Top bar (small)**: Adjustment needed
  - Color: Based on delta
    - Green: Need to increase (>+3 t/h)
    - Yellow: Moderate change (-3 to +3 t/h)
    - Red: Need to decrease (<-3 t/h)
  - Height: Delta value (±10 t/h max)
  - Badge: Shows delta with arrow (↑ +2, → +1, ↓ -1)

---

## Implementation

### Updated ChartPoint Interface

```typescript
interface ChartPoint {
  name: string;
  current: number; // Current ore rate (large bar)
  adjustment: number; // Adjustment needed (small bar, can be negative)
  deltaTh: number; // Delta vs current rate
  required: number; // Required shift rate
  currentDisplay: string;
  deltaDisplay: string;
}
```

### Data Mapping

```typescript
return data.map((item) => {
  const deltaTh = item.requiredShiftRate - item.currentRate;

  return {
    name: item.millId.replace("Mill", "M"),
    current: item.currentRate, // e.g., 170 t/h
    adjustment: deltaTh, // e.g., +2 t/h
    deltaTh,
    required: item.requiredShiftRate, // e.g., 172 t/h
    currentDisplay: String(Math.round(item.currentRate)),
    deltaDisplay: `${deltaTh > 0 ? "+" : ""}${Math.round(deltaTh)}`,
  };
});
```

### Stacked Bars Implementation

```typescript
{
  /* Large bar showing current ore rate */
}
<Bar dataKey="current" stackId="a" fill="#64748b" name="Current Rate">
  <LabelList
    dataKey="currentDisplay"
    position="center"
    style={{ fill: "white", fontSize: 11, fontWeight: 600 }}
  />
</Bar>;

{
  /* Small bar on top showing adjustment */
}
<Bar
  dataKey="adjustment"
  stackId="a"
  label={renderCustomLabel}
  name="Adjustment"
>
  {chartData.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={getBadgeColor(entry.deltaTh)} />
  ))}
</Bar>;
```

---

## Example Scenarios

### Scenario 1: Mill Needs Increase

```
Current: 170 t/h (gray bar)
Required: 175 t/h
Adjustment: +5 t/h (green bar on top)
Badge: ↑ +5 (green)
```

### Scenario 2: Mill Needs Decrease

```
Current: 172 t/h (gray bar)
Required: 168 t/h
Adjustment: -4 t/h (red bar below, shown as negative)
Badge: ↓ -4 (red)
```

### Scenario 3: Mill OK

```
Current: 170 t/h (gray bar)
Required: 171 t/h
Adjustment: +1 t/h (yellow bar on top)
Badge: → +1 (yellow)
```

---

## Color Coding

### Badge Colors (based on delta)

- **Green (#10b981)**: Delta > +3 t/h (strong increase)
- **Yellow (#fbbf24)**: Delta between -3 and +3 t/h (moderate)
- **Red (#ef4444)**: Delta < -3 t/h (decrease)

### Bar Colors

- **Current rate bar**: Gray (#64748b)
- **Adjustment bar**: Uses badge color (green/yellow/red)

---

## Tooltip Content

```
Mill: M01
Current: 170 t/h
Required: 175 t/h
↑ Adjustment: +5 t/h (in green)
```

---

## Y-Axis Scale

The Y-axis will automatically scale to show:

- Minimum: 0 t/h
- Maximum: Highest (current + adjustment) value
- Typical range: 0-180 t/h

---

## Legend

Bottom of chart shows:

- 🟢 ↑ Strong change (>+3 t/h increase)
- 🟡 → Moderate (-3 to +3 t/h)
- 🔴 ↓ Small / negative (<-3 t/h decrease)

---

## Calculation Logic

### For Each Mill:

1. **Get current rate** from API

   ```
   current = millOreRates[millId]  // e.g., 170 t/h
   ```

2. **Calculate required rate** based on target

   ```
   // Proportional to mill's share of total
   share = current / totalCurrent
   required = (targetRate * share)  // e.g., 175 t/h
   ```

3. **Calculate adjustment**

   ```
   adjustment = required - current  // e.g., +5 t/h
   ```

4. **Determine color**
   ```
   if (adjustment > 3) → green
   else if (adjustment < -3) → red
   else → yellow
   ```

---

## Expected Visual Result

```
Per-Mill Ore Feed Recommendations

180 ┤
    │
160 ┤  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐  ┌─┐
    │  │+│  │+│  │+│  │+│  │+│  │+│  │+│  │+│  │+│  │+│  │+│  │+│
140 ┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤  ├─┤
    │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │
120 ┤  │1│  │1│  │1│  │1│  │1│  │1│  │1│  │1│  │1│  │1│  │1│  │1│
    │  │7│  │7│  │7│  │7│  │7│  │7│  │7│  │7│  │7│  │7│  │7│  │7│
100 ┤  │0│  │0│  │0│  │0│  │0│  │0│  │0│  │0│  │0│  │0│  │0│  │0│
    │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │
 80 ┤  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │ │
    │  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘  └─┘
 60 ┤
    │
 40 ┤
    │
 20 ┤
    │
  0 ┴────────────────────────────────────────────────────────────
     M01  M02  M03  M04  M05  M06  M07  M08  M09  M10  M11  M12

🟢 ↑ Strong change    🟡 → Moderate    🔴 ↓ Small / negative
```

---

## Files Modified

1. ✅ `components/PerMillOreSetpointChart.tsx`
   - Updated `ChartPoint` interface
   - Changed data mapping to use `current` and `adjustment`
   - Implemented stacked bars (current + adjustment)
   - Updated tooltip to show current, required, and adjustment
   - Color-coded adjustment bars based on delta

---

## Key Differences

### Before (Incorrect)

- Single bar showing required rate (~170 t/h)
- No visual distinction between current and target
- Delta shown only in badge

### After (Correct)

- **Two stacked bars**:
  - Large gray bar = current rate (~170 t/h)
  - Small colored bar = adjustment (±10 t/h)
- Clear visual of "where we are" vs "where we need to be"
- Color indicates direction and magnitude of change

---

**Status:** ✅ Fixed and Ready for Testing  
**Date:** November 20, 2025

**Impact:** Chart now correctly visualizes current rates and required adjustments
