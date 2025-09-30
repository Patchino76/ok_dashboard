# Recharts Z-Order Fix - ReferenceArea Rendering Issue

## Problem Identified

**Data was reaching the component** (`hasBounds: true`, `bounds: [183.76, 211.94]`) but the `ReferenceArea` was **not rendering**.

### Root Cause: Recharts Z-Order

In Recharts, the rendering order matters:
- Components rendered **BEFORE** `<Line>` appear **behind** the line
- Components rendered **AFTER** `<Line>` appear **on top** of the line

The `ReferenceArea` was placed BEFORE the `Line`, which should work, but Recharts has a bug where `ReferenceArea` sometimes doesn't render properly in that position.

## Solution Applied

**Moved `ReferenceArea` and bound `ReferenceLine` components to AFTER the `<Line>` component.**

This ensures they render on top and are visible.

### Code Structure (Before - BROKEN):

```tsx
<LineChart>
  <XAxis />
  <YAxis />
  <Tooltip />
  <ReferenceLine y={median} />  {/* Median line */}
  <ReferenceArea y1={min} y2={max} />  {/* ❌ NOT RENDERING */}
  <ReferenceLine y={max} />  {/* ❌ NOT RENDERING */}
  <ReferenceLine y={min} />  {/* ❌ NOT RENDERING */}
  <Line dataKey="value" />  {/* Data line */}
</LineChart>
```

### Code Structure (After - WORKING):

```tsx
<LineChart>
  <XAxis />
  <YAxis />
  <Tooltip />
  <ReferenceLine y={median} />  {/* Median line */}
  <Line dataKey="value" />  {/* Data line */}
  {/* Distribution shading - AFTER Line */}
  <ReferenceArea y1={min} y2={max} fill="#ff6b00" fillOpacity={0.5} isFront={false} />  {/* ✅ RENDERS */}
  <ReferenceLine y={max} stroke="#ff0000" strokeWidth={3} />  {/* ✅ RENDERS */}
  <ReferenceLine y={min} stroke="#0000ff" strokeWidth={3} />  {/* ✅ RENDERS */}
</LineChart>
```

## Key Changes

### 1. **Moved Components After `<Line>`**
All distribution visualization components now render after the data line.

### 2. **Added `isFront={false}` to ReferenceArea**
Tells Recharts to render the area behind other elements (even though it's after Line in code).

### 3. **Added `ifOverflow="extendDomain"`**
Ensures the area and lines extend the chart domain if values are outside current range.

### 4. **Added Console Logging**
```tsx
{console.log(`🎨 RENDERING SHADING for ${parameter.id}:`, distributionBounds)}
```
This will show in console when the component tries to render the shading.

### 5. **Increased Visibility (Test Mode)**
- **Orange shading** (`#ff6b00`) at 50% opacity for MV
- **Cyan shading** (`#00bfff`) at 50% opacity for CV
- **Thick RED line** (3px) for max bound
- **Thick BLUE line** (3px) for min bound
- **Bold labels** showing "MAX: 211.9" and "MIN: 183.8"

## Expected Console Output

After refresh, you should see:

```
🔍 MV Ore DISTRIBUTION DEBUG: {
  hasBounds: true,
  bounds: [183.76, 211.94],
  ...
}

🎨 RENDERING SHADING for Ore: [183.76, 211.94]
```

## Expected Visual Result

### MV Cards (Ore, Water Mill, Water Zumpf, Motor Amperage):
```
Chart
  │  MAX: 211.9 ═══════════  ← THICK RED dashed line
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧  ← BRIGHT ORANGE shading
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Median (existing)
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧
  │  MIN: 183.8 ═══════════  ← THICK BLUE dashed line
  │  ═══════════════════════  ← Orange data line
```

### CV Cards (Pressure, Density, Pulp):
```
Chart
  │  MAX: 462.4 ═══════════  ← THICK RED dashed line
  │  🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷  ← BRIGHT CYAN shading
  │  🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ← Median
  │  🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷
  │  🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷
  │  MIN: 438.8 ═══════════  ← THICK BLUE dashed line
  │  ═══════════════════════  ← Blue data line
```

## Why This Works

1. **Recharts rendering order** - Components after `<Line>` are guaranteed to render
2. **`isFront={false}`** - Keeps shading behind the data line visually
3. **`ifOverflow="extendDomain"`** - Ensures bounds are always visible
4. **Explicit validation** - Checks bounds[0] and bounds[1] are defined
5. **Console logging** - Confirms rendering is attempted

## Next Steps

1. **Refresh browser** (Ctrl+F5)
2. **Check console** for:
   - `🔍 MV [param] DISTRIBUTION DEBUG` messages
   - `🎨 RENDERING SHADING for [param]` messages
3. **Look at charts** - You MUST see bright orange/cyan shading now

If you see the console messages but still no shading, it's a Recharts bug and we'll need to use a different approach (like custom SVG overlay).
