# Complete Bulgarian Translation - Final Update

## All Remaining Translations Completed

### Parameter Section Headers

**Before** → **After**:
- "Manipulated Variables (MV)" → **"Манипулирани променливи (МП)"**
- "Controlled Variables (CV)" → **"Контролирани променливи (КП)"**
- "Disturbance Variables (DV)" → **"Смущаващи променливи (СП)"**

### Parameter Descriptions

**Before** → **After**:
- "Variables we can control and optimize" → **"Променливи, които можем да контролираме и оптимизираме"**
- "Variables we measure and predict" → **"Променливи, които измерваме и прогнозираме"**
- "External factors and lab-analyzed parameters" → **"Външни фактори и лабораторно анализирани параметри"**

### Other Labels

**Before** → **After**:
- "Mill Recovery Fraction" → **"Фракция на извличане в мелницата"**
- "Target range" → **"Целеви диапазон"**

## Files Updated in This Round

1. **translations/bg.ts**
   - Added `manipulatedFull`, `controlledFull`, `disturbanceFull`
   - Added `manipulatedDescription`, `controlledDescription`, `disturbanceDescription`
   - Added `targetRange`
   - Added `millRecoveryFraction`

2. **target-cascade-trend.tsx**
   - Updated "Mill Recovery Fraction" title

3. **cv-parameter-card.tsx**
   - Updated "Target range" label

4. **cascade-simulation-interface.tsx**
   - Updated all three section headers (MV, CV, DV)

5. **cascade-optimization-dashboard.tsx**
   - Updated parameter section titles and descriptions in optimization tab

6. **cascade-flow-diagram.tsx**
   - Added missing `Target` import (fixed lint error)
   - Updated all parameter group titles and descriptions

## Complete Translation Keys Reference

```typescript
export const cascadeBG = {
  // Main titles
  title: "Каскадна оптимизация",
  subtitle: "Усъвършенствана каскадна оптимизация за максимална ефективност",
  
  // Tabs
  tabs: {
    overview: "Преглед",
    training: "Обучение",
    optimization: "Оптимизация",
    simulation: "Симулация",
  },
  
  // System status
  status: {
    optimizing: "ОПТИМИЗИРА...",
    ready: "ГОТОВ",
    configuring: "КОНФИГУРИРАНЕ",
    cascadeActive: "Каскада активна",
  },
  
  // Mill selection
  mill: {
    selection: "Избор на мелница",
    selectedMill: "Избрана мелница",
    noModels: "Няма налични каскадни модели",
  },
  
  // Model information
  model: {
    features: "Характеристики на модела",
    targetVariable: "Целева променлива",
    status: "Състояние на каскадния модел",
    loaded: "Зареден",
    notLoaded: "Няма зареден каскаден модел",
    readyForPredictions: "Готов за прогнози",
    loadedNotReady: "Моделът е зареден, но не е готов",
    loading: "Зареждане на модел...",
    error: "Грешка",
  },
  
  // Parameter types (COMPLETE)
  parameters: {
    manipulated: "Манипулирани променливи",
    manipulatedShort: "МП",
    manipulatedFull: "Манипулирани променливи (МП)",
    manipulatedDescription: "Променливи, които можем да контролираме и оптимизираме",
    controlled: "Контролирани променливи",
    controlledShort: "КП",
    controlledFull: "Контролирани променливи (КП)",
    controlledDescription: "Променливи, които измерваме и прогнозираме",
    disturbance: "Смущаващи променливи",
    disturbanceShort: "СП",
    disturbanceFull: "Смущаващи променливи (СП)",
    disturbanceDescription: "Външни фактори и лабораторно анализирани параметри",
    target: "Целева променлива",
    targetRange: "Целеви диапазон",
  },
  
  // Parameter cards
  card: {
    currentValue: "Текуща стойност",
    setpoint: "Задание",
    bounds: "Граници",
    min: "Мин",
    max: "Макс",
    slider: "Плъзгач",
    pv: "PV",
    sp: "SP",
  },
  
  // Target trend
  target: {
    title: "Целева стойност",
    millRecoveryFraction: "Фракция на извличане в мелницата",
    current: "Текуща",
    setpoint: "Задание",
    prediction: "Прогноза",
    simulation: "Симулация",
    manual: "Ръчно",
    optimizationTarget: "Цел на оптимизацията",
    timeWindow: "Времеви прозорец",
    hours: "часа",
  },
  
  // Optimization controls
  optimization: {
    start: "Старт",
    stop: "Стоп",
    startOptimization: "Старт оптимизация",
    stopOptimization: "Стоп оптимизация",
    targetDriven: "Целево-ориентирана оптимизация",
    configuration: "Конфигурация на оптимизацията",
    goal: "Цел на оптимизацията",
    goalDescription: "Изберете дали да максимизирате или минимизирате целевата стойност",
    maximize: "Максимизиране",
    minimize: "Минимизиране",
    targetValue: "Целева стойност",
    tolerance: "Толеранс",
    confidenceLevel: "Ниво на доверие",
    trials: "Брой опити",
    nTrials: "Брой опити",
    applyResults: "Приложи",
    clearResults: "Изчисти",
    resetToDefaults: "Нулиране",
    resetToPV: "Към PV",
    running: "Изпълнява се...",
    completed: "Завършена",
    failed: "Неуспешна",
    inProgress: "В процес...",
  },
  
  // Training
  training: {
    title: "Обучение на модел",
    startDate: "Начална дата",
    endDate: "Крайна дата",
    testSize: "Размер на тестовата извадка",
    resampleFreq: "Честота на препробване",
    modelSuffix: "Суфикс на модела",
    selectFeatures: "Избор на характеристики",
    selectTarget: "Избор на целева променлива",
    startTraining: "Старт обучение",
    inProgress: "Обучението е в ход...",
    success: "Обучението завърши успешно",
    failed: "Обучението се провали",
  },
  
  // Simulation
  simulation: {
    title: "Симулация",
    mode: "Режим на симулация",
    realTime: "Реално време",
    manual: "Ръчен",
    resetToDefaults: "Нулиране до стандартни",
    resetToPV: "Нулиране до PV",
    applySetpoints: "Приложи задания",
    testPrediction: "Тест прогноза",
    predicting: "Прогнозиране...",
  },
  
  // Messages
  messages: {
    loadingModel: "Зареждане на модел...",
    modelLoaded: "Моделът е зареден успешно",
    optimizationStarted: "Оптимизацията стартира",
    optimizationCompleted: "Оптимизацията завърши",
    optimizationFailed: "Оптимизацията се провали",
    trainingStarted: "Обучението стартира",
    trainingCompleted: "Обучението завърши",
    trainingFailed: "Обучението се провали",
    predictionSuccess: "Прогнозата е успешна",
    predictionFailed: "Прогнозата се провали",
  },
  
  // Common actions (short names for buttons)
  actions: {
    apply: "Приложи",
    cancel: "Отказ",
    reset: "Нулиране",
    save: "Запази",
    load: "Зареди",
    refresh: "Обнови",
    clear: "Изчисти",
    start: "Старт",
    stop: "Стоп",
    close: "Затвори",
    edit: "Редактирай",
    delete: "Изтрий",
    confirm: "Потвърди",
    back: "Назад",
    next: "Напред",
    finish: "Завърши",
  },
  
  // System overview
  overview: {
    title: "Преглед на системата и каскаден поток",
    cascadeFlow: "Каскаден поток",
    processFlow: "Процесен поток",
    modelInsights: "Информация за модела",
  },
};
```

## Summary of All Translated Components

### ✅ Fully Translated:
1. **Main Dashboard** - All titles, tabs, status badges
2. **Mill Selection** - Labels and options
3. **Model Information** - All status messages
4. **Parameter Cards (MV/CV/DV)** - Names, badges, labels, values
5. **Optimization Configuration** - All settings and controls
6. **Target Trend** - Title and all labels
7. **Simulation Interface** - All section headers
8. **Cascade Flow Diagram** - All titles and descriptions
9. **All Buttons** - Short names that fit the UI
10. **All Toggle Switches** - Labels and descriptions

### ✅ Preserved in English:
- Units: t/h, m³/h, A, bar, kg/m³, %
- Technical abbreviations: PV, SP, MV, CV, DV
- Debug labels (for developers)

## Result

**100% Bulgarian translation coverage** for all user-facing text in the Cascade Optimization UI, with parameter names pulled from `mills-parameters.ts` which already contains proper Bulgarian names and descriptions.

The interface now provides a complete Bulgarian-language experience while maintaining technical accuracy with English units and abbreviations.
