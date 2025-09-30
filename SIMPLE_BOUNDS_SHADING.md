# Simple Distribution Visualization - Two Dashed Lines with Shading

## New Approach

Completely simplified the distribution visualization:

### What You'll See:

1. **Two thin dashed lines** marking the distribution bounds (5th and 95th percentile)
2. **Shaded area between the lines** (30% opacity)
3. **Labels** showing "95%" and "5%" on the bound lines
4. **Median line** in the middle (existing dashed line)

## Visual Result

```
Chart
  │
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Upper bound (95%) - thin dashed line
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← Shaded area (30% opacity amber/blue)
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Median line (existing)
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Lower bound (5%) - thin dashed line
  │
  └──────────────────────────> Time
```

## Implementation

### MV Cards (Amber):
- Shaded area: `#fbbf24` (light amber) at 30% opacity
- Bound lines: `#f59e0b` (medium amber), 1px thick, dashed (3-3 pattern)

### CV Cards (Blue):
- Shaded area: `#60a5fa` (light blue) at 30% opacity
- Bound lines: `#3b82f6` (medium blue), 1px thick, dashed (3-3 pattern)

## Code Structure

```tsx
{distributionPercentiles && (
  <>
    {/* Shaded area */}
    <ReferenceArea
      y1={distributionPercentiles.p5}
      y2={distributionPercentiles.p95}
      fill="#fbbf24"
      fillOpacity={0.3}
      stroke="none"
    />
    {/* Upper bound line */}
    <ReferenceLine
      y={distributionPercentiles.p95}
      stroke="#f59e0b"
      strokeWidth={1}
      strokeDasharray="3 3"
      label={{ value: '95%', position: 'right' }}
    />
    {/* Lower bound line */}
    <ReferenceLine
      y={distributionPercentiles.p5}
      stroke="#f59e0b"
      strokeWidth={1}
      strokeDasharray="3 3"
      label={{ value: '5%', position: 'right' }}
    />
  </>
)}
```

## Why This Should Work

1. **Simple ReferenceArea** - No gradients, no complex layering
2. **Clear bounds** - Two visible dashed lines show the range
3. **Solid fill** - Simple color with opacity
4. **No z-order issues** - ReferenceArea naturally renders behind lines
5. **Visible labels** - Shows what the bounds represent

## Debug Logging

Added console logging to verify percentiles:

```
✅ MV Ore has distribution percentiles: { p5: 185.2, p25: 190.1, ... }
❌ MV WaterMill NO percentiles
```

## Next Steps

1. **Refresh browser** (Ctrl+F5)
2. **Run target optimization**
3. **Check console** for percentile logs
4. **Look for**:
   - Two thin dashed lines (upper and lower bounds)
   - Shaded area between them
   - Labels "95%" and "5%" on the right side

## If Still Not Visible

Check console for:
- `✅ MV [param] has distribution percentiles` - Percentiles are being passed
- `❌ MV [param] NO percentiles` - Percentiles are missing

If you see ✅ but still no shading:
- Inspect the DOM (F12 → Elements)
- Look for `<ReferenceArea>` element
- Check if y1 and y2 values are valid numbers
- Verify fillOpacity is 0.3 (not 0)

This is the simplest possible approach - just a shaded rectangle with two dashed lines!
