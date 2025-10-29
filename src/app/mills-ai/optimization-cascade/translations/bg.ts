// Bulgarian translations for Cascade Optimization UI
// Units and abbreviations remain in English

export const cascadeBG = {
  // Main titles
  title: "Каскадна оптимизация",
  subtitle: "",

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
    features: "Параметри на модела",
    targetVariable: "Целеви параметър",
    status: "Състояние на каскадния модел",
    loaded: "Зареден",
    notLoaded: "Няма зареден каскаден модел",
    readyForPredictions: "Готов за прогнози",
    loadedNotReady: "Моделът е зареден, но не е готов",
    loading: "Зареждане на модел...",
    error: "Грешка",
  },

  // Parameter types
  parameters: {
    manipulated: "Манипулирани параметри",
    manipulatedShort: "МП",
    manipulatedFull: "Манипулирани параметри (МП)",
    manipulatedDescription:
      "Параметри, които можем да контролираме и оптимизираме",
    controlled: "Контролирани параметри",
    controlledShort: "КП",
    controlledFull: "Контролирани параметри (КП)",
    controlledDescription: "Параметри, които измерваме и прогнозираме",
    disturbance: "Смущаващи параметри",
    disturbanceShort: "СП",
    disturbanceFull: "Смущаващи параметри (СП)",
    disturbanceDescription:
      "Параметри на рудата и лабораторно анализирани параметри",
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
    goalDescription:
      "Изберете дали да максимизирате или минимизирате целевата стойност",
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

// Helper function to get parameter name in Bulgarian from mills-parameters
export function getParameterNameBG(
  parameterId: string,
  millsParameters: any[]
): string {
  const param = millsParameters.find((p) => p.id === parameterId);
  return param?.name || parameterId;
}

// Helper function to get parameter description in Bulgarian
export function getParameterDescriptionBG(
  parameterId: string,
  millsParameters: any[]
): string {
  const param = millsParameters.find((p) => p.id === parameterId);
  return param?.description || "";
}
