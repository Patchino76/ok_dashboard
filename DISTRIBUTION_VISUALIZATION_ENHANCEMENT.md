# Enhanced Distribution Visualization for Cascade Optimization

## Overview
Implemented beautiful gradient shading to visualize parameter distributions from target-driven optimization results, replacing the simple flat shading with multi-layered confidence bands.

## Visual Design

### Gradient Layers (from outer to inner):

1. **95th Percentile Band (Lightest)**
   - Range: 5th to 95th percentile
   - Color: Gradient from light amber/blue to medium
   - Opacity: 15%
   - Represents: 90% confidence interval

2. **75th Percentile Band (Medium)**
   - Range: 25th to 75th percentile  
   - Color: Gradient from medium to darker amber/blue
   - Opacity: 25%
   - Represents: Interquartile range (50% of data)

3. **50th Percentile Band (Darkest)**
   - Range: Tight band around median (±0.5%)
   - Color: Solid amber/blue
   - Opacity: 40%
   - Represents: Median value highlight

### Color Schemes:

**MV Parameters (Manipulated Variables):**
- Outer gradient: `#fbbf24` (amber-400) → `#f59e0b` (amber-500)
- Middle gradient: `#f59e0b` (amber-500) → `#d97706` (amber-600)
- Median band: `#f59e0b` (amber-500)

**CV Parameters (Controlled Variables):**
- Outer gradient: `#60a5fa` (blue-400) → `#3b82f6` (blue-500)
- Middle gradient: `#3b82f6` (blue-500) → `#2563eb` (blue-600)
- Median band: `#3b82f6` (blue-500)

## Implementation Details

### Files Modified:

1. **`mv-parameter-card.tsx`**
   - Added `distributionPercentiles` prop with p5, p25, p50, p75, p95
   - Added SVG gradient definitions (`gradientOuter`, `gradientMiddle`)
   - Replaced single `ReferenceArea` with three layered bands
   - Fallback to simple bounds if percentiles unavailable

2. **`cv-parameter-card.tsx`**
   - Same structure as MV card but with blue color scheme
   - Uses `cvGradientOuter` and `cvGradientMiddle` IDs to avoid conflicts

3. **`parameter-cascade-optimization-card.tsx`**
   - Updated interface to include `distributionPercentiles`
   - Passes percentiles to both MV and CV cards

4. **`cascade-optimization-dashboard.tsx`**
   - Enhanced `distributionData` calculation to extract percentiles
   - Handles both integer keys ("5", "25") and float keys ("5.0", "25.0")
   - Fallback to min/max values if specific percentiles missing
   - Passes percentiles to parameter cards

### Data Flow:

```
Target Optimization API Response
  └─> ParameterDistribution (with percentiles)
      └─> cascade-optimization-store (parameterDistributions)
          └─> Dashboard extracts percentiles
              └─> Parameter cards render gradient bands
```

### Percentile Extraction Logic:

```typescript
const p5 = dist.percentiles["5"] || dist.percentiles["5.0"] || dist.min_value;
const p25 = dist.percentiles["25"] || dist.percentiles["25.0"];
const p50 = dist.percentiles["50"] || dist.percentiles["50.0"] || dist.median;
const p75 = dist.percentiles["75"] || dist.percentiles["75.0"];
const p95 = dist.percentiles["95"] || dist.percentiles["95.0"] || dist.max_value;
```

## User Experience

### Before:
- Single flat shaded area (min to max)
- No visual indication of confidence levels
- Median shown only as dashed line

### After:
- **Three layered gradient bands** creating depth
- **Visual confidence hierarchy**: Darker = more likely values
- **Smooth gradient transitions** for professional look
- **Median highlighted** with darkest band
- **Fallback support** for simple bounds if percentiles unavailable

## Technical Benefits

1. **No Performance Impact**: Uses native Recharts `ReferenceArea` components
2. **Responsive**: Gradients scale with chart dimensions
3. **Accessible**: Color contrast maintained for visibility
4. **Backward Compatible**: Falls back to simple shading if percentiles missing
5. **Type Safe**: Full TypeScript support with proper interfaces

## Example Visualization

```
Chart Y-axis
    │
    │  ┌─────────────────────────────┐  ← 95th percentile (lightest)
    │  │  ┌───────────────────────┐  │  ← 75th percentile (medium)
    │  │  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │  │  ← Median (darkest)
    │  │  └───────────────────────┘  │
    │  └─────────────────────────────┘
    │
    └──────────────────────────────────> Time
```

## Testing

To test the visualization:

1. Run target-driven optimization with sufficient trials (500+)
2. Check parameter cards in optimization tab
3. Verify three distinct gradient layers visible
4. Confirm colors match parameter type (amber for MV, blue for CV)
5. Check median line aligns with darkest band center

## Future Enhancements

Potential improvements:
- Add tooltip showing exact percentile values on hover
- Animate gradient transitions when optimization completes
- Add distribution shape indicators (normal, skewed, bimodal)
- Show sample count badge for distribution quality
- Add "confidence quality" indicator based on trial count
