# Bulgarian Translation Implementation for Cascade Optimization UI

## Summary
Successfully implemented Bulgarian (Cyrillic) translations for the Cascade Optimization UI while preserving English units and abbreviations. Parameter names are now pulled from `mills-parameters.ts` which already contains Bulgarian names and descriptions.

## Files Created

### 1. Translation Constants File
**File**: `src/app/mills-ai/optimization-cascade/translations/bg.ts`

Contains:
- `cascadeBG` object with all UI text translations
- Helper functions:
  - `getParameterNameBG()` - Gets Bulgarian parameter name from mills-parameters
  - `getParameterDescriptionBG()` - Gets Bulgarian parameter description

**Translation Categories**:
- Main titles and subtitles
- Tab names (Преглед, Обучение, Оптимизация, Симулация)
- System status labels
- Mill selection labels
- Model information labels
- Parameter type labels (МП, КП, СП for MV, CV, DV)
- Card labels (Текуща стойност, Задание, Граници, etc.)
- Target trend labels
- Optimization controls
- Training labels
- Simulation labels
- Messages and actions

## Files Modified

### 2. Main Dashboard Component
**File**: `cascade-optimization-dashboard.tsx`

**Changes**:
- Added import: `import { cascadeBG } from "../translations/bg"`
- Updated main title: `{cascadeBG.title}` → "Каскадна оптимизация"
- Updated subtitle: `{cascadeBG.subtitle}`
- Updated all tab labels to Bulgarian
- Updated system status badges (ГОТОВ, ОПТИМИЗИРА, КОНФИГУРИРАНЕ)
- Updated mill selection labels
- Updated model information labels
- Updated all section titles and descriptions

### 3. MV Parameter Card
**File**: `mv-parameter-card.tsx`

**Changes**:
- Added imports for `millsParameters` and translation helpers
- Parameter name: Uses `getParameterNameBG(parameter.id, millsParameters)`
- Badge labels: "МП" (Manipulated Short), "Манипулирани променливи"
- Status badges: "В граници" / "Извън граници"
- Value labels: "Текуща стойност", "Задание (SP)"

**Example Output**:
- "Разход на руда" instead of "Ore"
- "Вода в мелницата" instead of "Water Mill"
- "Ток на елетродвигателя" instead of "Motor Amp"

### 4. CV Parameter Card
**File**: `cv-parameter-card.tsx`

**Changes**:
- Added imports for `millsParameters` and translation helpers
- Added missing React hooks: `useState`, `useEffect`
- Parameter name: Uses `getParameterNameBG(parameter.id, millsParameters)`
- Badge labels: "КП" (Controlled Short), "Контролирани променливи"
- Value labels: "Текуща стойност (PV)"

**Example Output**:
- "Пулп в ХЦ" instead of "PulpHC"
- "Плътност на ХЦ" instead of "DensityHC"
- "Налягане на ХЦ" instead of "PressureHC"

### 5. DV Parameter Card
**File**: `dv-parameter-card.tsx`

**Changes**:
- Added imports for `millsParameters` and translation helpers
- Parameter name: Uses `getParameterNameBG(parameter.id, millsParameters)`
- Badge labels: "СП" (Disturbance Short), "Смущаващи променливи"
- Value labels: "Текуща стойност"

**Example Output**:
- "Шисти" instead of "Shisti"
- "Дайки" instead of "Daiki"
- "Желязо" instead of "FE"

## What Was NOT Translated

As requested, the following remain in English:
- **Units**: t/h, m³/h, A, kg/m³, bar, %, etc.
- **Abbreviations**: PV, SP, MV, CV, DV (also shown as МП, КП, СП in badges)
- **Technical IDs**: Ore, WaterMill, PSI80, PSI200, etc. (used internally)

## Parameter Names Source

All parameter names come from `mills-parameters.ts`:
```typescript
{
  id: "Ore",
  name: "Разход на руда",  // ← Used in UI
  unit: "t/h",             // ← Kept in English
  description: "Разход на входяща руда към мелницата"
}
```

## Usage Pattern

Throughout the UI:
```typescript
// Import translations
import { cascadeBG, getParameterNameBG } from "../translations/bg";
import { millsParameters } from "../../data/mills-parameters";

// Use in JSX
<CardTitle>{getParameterNameBG(parameter.id, millsParameters)}</CardTitle>
<span>{cascadeBG.card.currentValue}</span>
<Badge>{cascadeBG.parameters.manipulatedShort}</Badge>
```

## Benefits

1. **Centralized translations**: All text in one file (`bg.ts`)
2. **Consistent naming**: Uses existing Bulgarian names from `mills-parameters.ts`
3. **Easy maintenance**: Update translations in one place
4. **Type-safe**: TypeScript ensures all translation keys exist
5. **Preserves technical accuracy**: Units and abbreviations remain standard

## Future Enhancements

To add more translations:
1. Add new keys to `cascadeBG` object in `bg.ts`
2. Use `cascadeBG.section.key` in components
3. For parameter-specific text, use helper functions with `millsParameters`

## Testing

All UI text should now display in Bulgarian (Cyrillic) except:
- Units (t/h, m³/h, A, bar, kg/m³, %, etc.)
- Technical abbreviations (PV, SP)
- Internal IDs and variable names

The interface maintains full functionality while presenting a Bulgarian-language user experience.
