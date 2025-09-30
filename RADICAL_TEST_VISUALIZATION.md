# Radical Test - Highly Visible Distribution Shading

## What I Changed

Created a **TEST VERSION** with EXTREMELY visible colors to diagnose the issue:

### Test Colors (Impossible to Miss):

**MV Cards:**
- **Shaded area**: Bright orange (`#ff6b00`) at 50% opacity
- **Upper bound**: Thick RED line (`#ff0000`), 2px, dashed
- **Lower bound**: Thick BLUE line (`#0000ff`), 2px, dashed
- **Labels**: "Max: [value]" and "Min: [value]" with large 12px font

**CV Cards:**
- **Shaded area**: Bright cyan (`#00bfff`) at 50% opacity
- **Upper bound**: Thick RED line, 2px, dashed
- **Lower bound**: Thick BLUE line, 2px, dashed
- **Labels**: Same as MV

### Key Changes:

1. **Removed percentiles dependency** - Now ONLY uses `distributionBounds`
2. **Explicit undefined check** - `distributionBounds[0] !== undefined && distributionBounds[1] !== undefined`
3. **Rendered BEFORE the line** - Ensures it's behind the data
4. **50% opacity** - Much more visible than 30%
5. **Thick lines** - 2px instead of 1px
6. **Bright colors** - Red/Blue/Orange/Cyan are impossible to miss

## Expected Visual Result

If the data is reaching the component, you WILL see:

```
Chart
  │
  │  ═══════════════════  ← THICK RED dashed line (Max: 211.9)
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧  ← BRIGHT ORANGE shading (50% opacity)
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Median line (existing)
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  ═══════════════════  ← THICK BLUE dashed line (Min: 158.7)
  │
```

## Console Debug Output

Added comprehensive logging:

```
🔍 MV Ore DISTRIBUTION DEBUG: {
  hasBounds: true,
  bounds: [158.68, 211.99],
  hasPercentiles: true,
  percentiles: { p5: 158.68, p95: 211.99, ... },
  hasMedian: true,
  median: 207.47
}
```

## Diagnostic Scenarios

### Scenario 1: You see NOTHING
**Diagnosis**: `distributionBounds` is undefined or null
**Console shows**: `hasBounds: false`
**Problem**: Data not being passed from dashboard to component

### Scenario 2: You see the RED/BLUE lines but NO shading
**Diagnosis**: ReferenceArea not rendering
**Console shows**: `hasBounds: true, bounds: [min, max]`
**Problem**: Recharts ReferenceArea bug or z-index issue

### Scenario 3: You see EVERYTHING (orange shading + red/blue lines)
**Success!** The code works, we just need to adjust colors back to amber/blue

## Code Structure

```tsx
{distributionBounds && 
 distributionBounds[0] !== undefined && 
 distributionBounds[1] !== undefined && (
  <>
    {/* BRIGHT ORANGE shading at 50% opacity */}
    <ReferenceArea
      y1={distributionBounds[0]}
      y2={distributionBounds[1]}
      fill="#ff6b00"
      fillOpacity={0.5}
    />
    {/* THICK RED upper bound */}
    <ReferenceLine
      y={distributionBounds[1]}
      stroke="#ff0000"
      strokeWidth={2}
      strokeDasharray="5 5"
      label={{ value: `Max: ${distributionBounds[1].toFixed(1)}` }}
    />
    {/* THICK BLUE lower bound */}
    <ReferenceLine
      y={distributionBounds[0]}
      stroke="#0000ff"
      strokeWidth={2}
      strokeDasharray="5 5"
      label={{ value: `Min: ${distributionBounds[0].toFixed(1)}` }}
    />
  </>
)}
```

## Next Steps

1. **Refresh browser** (Ctrl+F5)
2. **Check console** for the debug messages
3. **Look at charts** - you CANNOT miss bright orange/cyan shading if it's there

### If you see the shading:
✅ Code works! Just need to change colors back to subtle amber/blue

### If you DON'T see the shading:
❌ Check console output and share what `hasBounds` and `bounds` values are

This test version will definitively show if:
- A) The data is reaching the component
- B) The ReferenceArea is rendering
- C) There's a z-index or visibility issue

The bright colors and thick lines are IMPOSSIBLE to miss if they're rendering!
