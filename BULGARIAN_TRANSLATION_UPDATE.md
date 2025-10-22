# Bulgarian Translation Update - Optimization Controls

## Additional Translations Completed

### Optimization Configuration Section

**Before** → **After**:
- "Optimization Configuration" → "Конфигурация на оптимизацията"
- "Optimization Goal" → "Цел на оптимизацията"
- "Choose whether to maximize or minimize the target value" → "Изберете дали да максимизирате или минимизирате целевата стойност"
- "Maximize" → "Максимизиране"
- "Minimize" → "Минимизиране"

### Auto-Apply Toggle

**Before** → **After**:
- "Auto-Apply Proposed Setpoints" → "Автоматично прилагане"
- "Automatically apply optimized parameters when optimization completes" → "Автоматично прилагане на оптимизираните параметри след завършване"
- "Manual" → "Ръчно"
- "Auto" → "Авто"

### Button Labels (Short Names)

**Before** → **After**:
- "Start Optimization" → "Старт оптимизация"
- "Optimizing..." → "Изпълнява се..." (from `cascadeBG.optimization.running`)
- "Reset" → "Нулиране" (from `cascadeBG.actions.reset`)
- "Show Distributions" → "Покажи разпределения"
- "Hide Distributions" → "Скрий разпределения"
- "Test Prediction" → "Тест прогноза"
- "Predicting..." → "Прогнозиране..."

### New Translation Keys Added

```typescript
// In cascadeBG.optimization:
configuration: "Конфигурация на оптимизацията"
goal: "Цел на оптимизацията"
goalDescription: "Изберете дали да максимизирате или минимизирате целевата стойност"
maximize: "Максимизиране"
minimize: "Минимизиране"
start: "Старт"  // Short version
stop: "Стоп"    // Short version
startOptimization: "Старт оптимизация"  // Full version
stopOptimization: "Стоп оптимизация"    // Full version
applyResults: "Приложи"     // Short
clearResults: "Изчисти"     // Short
resetToDefaults: "Нулиране"
resetToPV: "Към PV"
running: "Изпълнява се..."
inProgress: "В процес..."

// In cascadeBG.simulation:
testPrediction: "Тест прогноза"
predicting: "Прогнозиране..."

// In cascadeBG.actions (expanded):
close: "Затвори"
edit: "Редактирай"
delete: "Изтрий"
confirm: "Потвърди"
back: "Назад"
next: "Напред"
finish: "Завърши"
```

## Design Decisions

### Short Button Names
To fit the existing UI space, button labels use concise Bulgarian text:
- "Приложи" instead of "Приложи резултати"
- "Изчисти" instead of "Изчисти резултати"
- "Нулиране" instead of "Нулиране до стандартни стойности"
- "Старт" / "Стоп" for simple actions

### Full Descriptions
Longer descriptions remain detailed for clarity:
- Section titles use full names: "Конфигурация на оптимизацията"
- Helper text provides complete explanations
- Toggle labels are descriptive: "Автоматично прилагане на оптимизираните параметри след завършване"

## Files Modified

1. **translations/bg.ts**
   - Added optimization configuration translations
   - Added short button labels
   - Added simulation control labels
   - Expanded action labels

2. **cascade-optimization-dashboard.tsx**
   - Updated "Optimization Configuration" section
   - Updated maximize/minimize toggle
   - Updated auto-apply toggle
   - Updated all button labels
   - Updated loading states

## Usage Examples

### Optimization Goal Toggle
```tsx
<div className="text-sm font-medium">
  {cascadeBG.optimization.goal}
</div>
<div className="text-xs text-slate-500">
  {cascadeBG.optimization.goalDescription}
</div>
```

### Buttons
```tsx
// Short version for space-constrained buttons
<Button>{cascadeBG.actions.reset}</Button>

// Full version for primary actions
<Button>
  {isOptimizing 
    ? cascadeBG.optimization.running 
    : cascadeBG.optimization.startOptimization}
</Button>
```

## Complete Translation Coverage

The Cascade Optimization UI now has **complete Bulgarian translation** for:
- ✅ Main titles and navigation
- ✅ System status indicators
- ✅ Mill and model information
- ✅ Parameter cards (MV, CV, DV)
- ✅ Optimization configuration
- ✅ All buttons and controls
- ✅ Toggle switches and labels
- ✅ Loading and status messages

**Preserved in English:**
- ✅ Units (t/h, m³/h, A, bar, kg/m³, %)
- ✅ Technical abbreviations (PV, SP)
- ✅ Debug labels (for developer use)

## Result

The UI now presents a fully localized Bulgarian experience while maintaining technical accuracy and fitting within the existing design constraints.
