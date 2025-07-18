import { TagDefinition } from './types';

// Mill names configuration
export const millsNames = [
  {en: "Mill01", bg: "Мелница 01"},
  {en: "Mill02", bg: "Мелница 02"}, 
  {en: "Mill03", bg: "Мелница 03"},
  {en: "Mill04", bg: "Мелница 04"},
  {en: "Mill05", bg: "Мелница 05"},
  {en: "Mill06", bg: "Мелница 06"},
  {en: "Mill07", bg: "Мелница 07"},
  {en: "Mill08", bg: "Мелница 08"},
  {en: "Mill09", bg: "Мелница 09"},
  {en: "Mill10", bg: "Мелница 10"},
  {en: "Mill11", bg: "Мелница 11"},
  {en: "Mill12", bg: "Мелница 12"},
];

// Mills tags defining the shifts, totals and ore consumption for each mill
export const millsTags = {
  // Shift 1 total tags for each mill
  shift1: [
    {id: 562, name: "Mill01", desc: "Смяна 1 тотал: МА01", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 582, name: "Mill02", desc: "Смяна 1 тотал: МА02", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 532, name: "Mill03", desc: "Смяна 1 тотал: МА03", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1231, name: "Mill04", desc: "Смяна 1 тотал: МА04", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1239, name: "Mill05", desc: "Смяна 1 тотал: МА05", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1221, name: "Mill06", desc: "Смяна 1 тотал: МА06", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 463, name: "Mill07", desc: "Смяна 1 тотал: МА07", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 503, name: "Mill08", desc: "Смяна 1 тотал: МА08", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 511, name: "Mill09", desc: "Смяна 1 тотал: МА09", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 519, name: "Mill10", desc: "Смяна 1 тотал: МА10", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 524, name: "Mill11", desc: "Смяна 1 тотал: МА11", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 3794, name: "Mill12", desc: "Смяна 1 тотал: МА12", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
  ],
  // Shift 2 total tags for each mill
  shift2: [
    {id: 563, name: "Mill01", desc: "Смяна 2 тотал: МА01", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 583, name: "Mill02", desc: "Смяна 2 тотал: МА02", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 533, name: "Mill03", desc: "Смяна 2 тотал: МА03", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1232, name: "Mill04", desc: "Смяна 2 тотал: МА04", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1240, name: "Mill05", desc: "Смяна 2 тотал: МА05", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1222, name: "Mill06", desc: "Смяна 2 тотал: МА06", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 464, name: "Mill07", desc: "Смяна 2 тотал: МА07", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 504, name: "Mill08", desc: "Смяна 2 тотал: МА08", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 512, name: "Mill09", desc: "Смяна 2 тотал: МА09", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 520, name: "Mill10", desc: "Смяна 2 тотал: МА10", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 525, name: "Mill11", desc: "Смяна 2 тотал: МА11", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 3795, name: "Mill12", desc: "Смяна 2 тотал: МА12", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
  ],
  // Shift 3 total tags for each mill
  shift3: [
    {id: 564, name: "Mill01", desc: "Смяна 3 тотал: МА01", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 584, name: "Mill02", desc: "Смяна 3 тотал: МА02", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 534, name: "Mill03", desc: "Смяна 3 тотал: МА03", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1233, name: "Mill04", desc: "Смяна 3 тотал: МА04", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1241, name: "Mill05", desc: "Смяна 3 тотал: МА05", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1223, name: "Mill06", desc: "Смяна 3 тотал: МА06", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 465, name: "Mill07", desc: "Смяна 3 тотал: МА07", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 505, name: "Mill08", desc: "Смяна 3 тотал: МА08", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 513, name: "Mill09", desc: "Смяна 3 тотал: МА09", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 521, name: "Mill10", desc: "Смяна 3 тотал: МА10", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 526, name: "Mill11", desc: "Смяна 3 тотал: МА11", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 3797, name: "Mill12", desc: "Смяна 3 тотал: МА12", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
  ],
  // Total tags for all shifts for each mill
  total: [
    {id: 1213, name: "Mill01", desc: "Общо смени: МА01", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1215, name: "Mill02", desc: "Общо смени: МА02", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1210, name: "Mill03", desc: "Общо смени: МА03", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1245, name: "Mill04", desc: "Общо смени: МА04", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1246, name: "Mill05", desc: "Общо смени: МА05", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1247, name: "Mill06", desc: "Общо смени: МА06", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1200, name: "Mill07", desc: "Общо смени: МА07", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1202, name: "Mill08", desc: "Общо смени: МА08", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1204, name: "Mill09", desc: "Общо смени: МА09", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1205, name: "Mill10", desc: "Общо смени: МА10", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 1206, name: "Mill11", desc: "Общо смени: МА11", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
    {id: 3819, name: "Mill12", desc: "Общо смени: МА12", unit: "t", precision: 0, group: "Мелнично", icon: "weight"},
  ],
  // Ore consumption tags for each mill
  Ore: [
    {id: 485, name: "Mill01", desc: "Разход на руда МА01", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 488, name: "Mill02", desc: "Разход на руда МА02", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 491, name: "Mill03", desc: "Разход на руда МА03", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 494, name: "Mill04", desc: "Разход на руда МА04", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 497, name: "Mill05", desc: "Разход на руда МА05", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 500, name: "Mill06", desc: "Разход на руда МА06", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 455, name: "Mill07", desc: "Разход на руда МА07", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 467, name: "Mill08", desc: "Разход на руда МА08", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 476, name: "Mill09", desc: "Разход на руда МА09", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 479, name: "Mill10", desc: "Разход на руда МА10", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 482, name: "Mill11", desc: "Разход на руда МА11", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
    {id: 3786, name: "Mill12", desc: "Разход на руда МА12", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", maxValue: 240},
  ],
  // Water Mill tags for each mill
  WaterMill: [
    {id: 560, name: "Mill01", desc: "Вода МА01", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 580, name: "Mill02", desc: "Вода МА02", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 530, name: "Mill03", desc: "Вода МА03", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 1227, name: "Mill04", desc: "Вода МА04", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 1237, name: "Mill05", desc: "Вода МА05", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 1219, name: "Mill06", desc: "Вода МА06", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 461, name: "Mill07", desc: "Вода МА07", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 474, name: "Mill08", desc: "Вода МА08", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 509, name: "Mill09", desc: "Вода МА09", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 517, name: "Mill10", desc: "Вода МА10", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 522, name: "Mill11", desc: "Вода МА11", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 3790, name: "Mill12", desc: "Вода МА12", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
  ],
  // Water Zumpf tags for each mill
  WaterZumpf: [
    {id: 561, name: "Mill01", desc: "Вода зумпф МА01", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 581, name: "Mill02", desc: "Вода зумпф МА02", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 531, name: "Mill03", desc: "Вода зумпф МА03", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 1228, name: "Mill04", desc: "Вода зумпф МА04", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 1238, name: "Mill05", desc: "Вода зумпф МА05", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 1220, name: "Mill06", desc: "Вода зумпф МА06", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 462, name: "Mill07", desc: "Вода зумпф МА07", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 475, name: "Mill08", desc: "Вода зумпф МА08", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 510, name: "Mill09", desc: "Вода зумпф МА09", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 518, name: "Mill10", desc: "Вода зумпф МА10", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 523, name: "Mill11", desc: "Вода зумпф МА11", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
    {id: 3792, name: "Mill12", desc: "Вода зумпф МА12", unit: "m³/h", precision: 1, group: "Мелнично", icon: "water"},
  ],
  // Power tags for each mill
  Power: [
    {id: 487, name: "Mill01", desc: "Мощност МА01", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 490, name: "Mill02", desc: "Мощност МА02", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 493, name: "Mill03", desc: "Мощност МА03", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 496, name: "Mill04", desc: "Мощност МА04", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 499, name: "Mill05", desc: "Мощност МА05", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 502, name: "Mill06", desc: "Мощност МА06", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 460, name: "Mill07", desc: "Мощност МА07", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 471, name: "Mill08", desc: "Мощност МА08", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 478, name: "Mill09", desc: "Мощност МА09", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 481, name: "Mill10", desc: "Мощност МА10", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 483, name: "Mill11", desc: "Мощност МА11", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
    {id: 3773, name: "Mill12", desc: "Мощност МА12", unit: "kW", precision: 0, group: "Мелнично", icon: "energy"},
  ],
  // Zumpf Level tags for each mill
  ZumpfLevel: [
    {id: 486, name: "Mill01", desc: "Ниво на зумпф МА01", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 489, name: "Mill02", desc: "Ниво на зумпф МА02", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 492, name: "Mill03", desc: "Ниво на зумпф МА03", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 495, name: "Mill04", desc: "Ниво на зумпф МА04", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 498, name: "Mill05", desc: "Ниво на зумпф МА05", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 501, name: "Mill06", desc: "Ниво на зумпф МА06", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 458, name: "Mill07", desc: "Ниво на зумпф МА07", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 470, name: "Mill08", desc: "Ниво на зумпф МА08", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 477, name: "Mill09", desc: "Ниво на зумпф МА09", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 480, name: "Mill10", desc: "Ниво на зумпф МА10", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 484, name: "Mill11", desc: "Ниво на зумпф МА11", unit: "%", precision: 0, group: "Мелнично", icon: "level"},
    {id: 3747, name: "Mill12", desc: "Ниво на зумпф МА12", unit: "%", precision: 0, group: "Мелнично", icon: "level"}
  ],
  // PressureHC tags for each mill
  PressureHC: [
    {id: 558, name: "Mill01", desc: "Налягане в хидроциклон МА01", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 578, name: "Mill02", desc: "Налягане в хидроциклон МА02", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 528, name: "Mill03", desc: "Налягане в хидроциклон МА03", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 1225, name: "Mill04", desc: "Налягане в хидроциклон МА04", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 1235, name: "Mill05", desc: "Налягане в хидроциклон МА05", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 1217, name: "Mill06", desc: "Налягане в хидроциклон МА06", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 459, name: "Mill07", desc: "Налягане в хидроциклон МА07", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 472, name: "Mill08", desc: "Налягане в хидроциклон МА08", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 507, name: "Mill09", desc: "Налягане в хидроциклон МА09", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 515, name: "Mill10", desc: "Налягане в хидроциклон МА10", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2687, name: "Mill11", desc: "Налягане в хидроциклон МА11", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 3774, name: "Mill12", desc: "Налягане в хидроциклон МА12", unit: "bar", precision: 1, group: "Мелнично", icon: "pressure"},
  ],
  // DensityHC tags for each mill
  DensityHC: [
    {id: 557, name: "Mill01", desc: "Плътност на хидроциклон МА01", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 577, name: "Mill02", desc: "Плътност на хидроциклон МА02", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 527, name: "Mill03", desc: "Плътност на хидроциклон МА03", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 1224, name: "Mill04", desc: "Плътност на хидроциклон МА04", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 1234, name: "Mill05", desc: "Плътност на хидроциклон МА05", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 1216, name: "Mill06", desc: "Плътност на хидроциклон МА06", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 457, name: "Mill07", desc: "Плътност на хидроциклон МА07", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 469, name: "Mill08", desc: "Плътност на хидроциклон МА08", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 506, name: "Mill09", desc: "Плътност на хидроциклон МА09", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 514, name: "Mill10", desc: "Плътност на хидроциклон МА10", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 2658, name: "Mill11", desc: "Плътност на хидроциклон МА11", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
    {id: 3742, name: "Mill12", desc: "Плътност на хидроциклон МА12", unit: "g/l", precision: 0, group: "Мелнично", icon: "density"},
  ],
  // PulpHC tags for each mill
  PulpHC: [
    {id: 559, name: "Mill01", desc: "Пулп хидроциклон МА01", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 579, name: "Mill02", desc: "Пулп хидроциклон МА02", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 529, name: "Mill03", desc: "Пулп хидроциклон МА03", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 1226, name: "Mill04", desc: "Пулп хидроциклон МА04", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 1236, name: "Mill05", desc: "Пулп хидроциклон МА05", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 1218, name: "Mill06", desc: "Пулп хидроциклон МА06", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 3640, name: "Mill07", desc: "Пулп хидроциклон МА07", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 1000, name: "Mill08", desc: "Пулп хидроциклон МА08", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 508, name: "Mill09", desc: "Пулп хидроциклон МА09", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 516, name: "Mill10", desc: "Пулп хидроциклон МА10", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 2691, name: "Mill11", desc: "Пулп хидроциклон МА11", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
    {id: 3788, name: "Mill12", desc: "Пулп хидроциклон МА12", unit: "m³/h", precision: 1, group: "Мелнично", icon: "pump"},
  ],
  // PumpRPM tags for each mill
  PumpRPM: [
    {id: 2405, name: "Mill01", desc: "Обороти помпа МА01", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2198, name: "Mill02", desc: "Обороти помпа МА02", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2629, name: "Mill03", desc: "Обороти помпа МА03", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2745, name: "Mill04", desc: "Обороти помпа МА04", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 1652, name: "Mill05", desc: "Обороти помпа МА05", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2796, name: "Mill06", desc: "Обороти помпа МА06", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2856, name: "Mill07", desc: "Обороти помпа МА07", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 1800, name: "Mill08", desc: "Обороти помпа МА08", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2471, name: "Mill09", desc: "Обороти помпа МА09", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2452, name: "Mill10", desc: "Обороти помпа МА10", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 2690, name: "Mill11", desc: "Обороти помпа МА11", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
    {id: 3780, name: "Mill12", desc: "Обороти помпа МА12", unit: "RPM", precision: 0, group: "Мелнично", icon: "rotate"},
  ],
  // MotorAmp tags for each mill
  MotorAmp: [
    {id: 2379, name: "Mill01", desc: "Ток на двигателя МА01", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2153, name: "Mill02", desc: "Ток на двигателя МА02", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2602, name: "Mill03", desc: "Ток на двигателя МА03", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2719, name: "Mill04", desc: "Ток на двигателя МА04", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2210, name: "Mill05", desc: "Ток на двигателя МА05", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2770, name: "Mill06", desc: "Ток на двигателя МА06", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2830, name: "Mill07", desc: "Ток на двигателя МА07", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 1805, name: "Mill08", desc: "Ток на двигателя МА08", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2478, name: "Mill09", desc: "Ток на двигателя МА09", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2427, name: "Mill10", desc: "Ток на двигателя МА10", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 2663, name: "Mill11", desc: "Ток на двигателя МА11", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
    {id: 3748, name: "Mill12", desc: "Ток на двигателя МА12", unit: "A", precision: 1, group: "Мелнично", icon: "electricity"},
  ],
  // PSI80 tags for each mill
  PSI80: [
    {id: 2379, name: "Mill01", desc: "PSI80 МА01", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2153, name: "Mill02", desc: "PSI80 МА02", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2602, name: "Mill03", desc: "PSI80 МА03", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2719, name: "Mill04", desc: "PSI80 МА04", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2210, name: "Mill05", desc: "PSI80 МА05", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 5329, name: "Mill06", desc: "PSI80 МА06", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 5331, name: "Mill07", desc: "PSI80 МА07", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 5332, name: "Mill08", desc: "PSI80 МА08", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2478, name: "Mill09", desc: "PSI80 МА09", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2427, name: "Mill10", desc: "PSI80 МА10", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2663, name: "Mill11", desc: "PSI80 МА11", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 3748, name: "Mill12", desc: "PSI80 МА12", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
  ],
  // PSI200 tags for each mill
  PSI200: [
    {id: 2379, name: "Mill01", desc: "PSI200 МА01", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2153, name: "Mill02", desc: "PSI200 МА02", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2602, name: "Mill03", desc: "PSI200 МА03", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2719, name: "Mill04", desc: "PSI200 МА04", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2210, name: "Mill05", desc: "PSI200 МА05", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 5328, name: "Mill06", desc: "PSI200 МА06", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 5330, name: "Mill07", desc: "PSI200 МА07", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 5333, name: "Mill08", desc: "PSI200 МА08", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2478, name: "Mill09", desc: "PSI200 МА09", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2427, name: "Mill10", desc: "PSI200 МА10", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 2663, name: "Mill11", desc: "PSI200 МА11", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"},
    {id: 3748, name: "Mill12", desc: "PSI200 МА12", unit: "PSI", precision: 1, group: "Мелнично", icon: "pressure"}
  ]
};

// Mills dashboard tags for reference in the dashboard and KPI components
export const millsDashboardTags: TagDefinition[] = [
  // Mill summary tags for the dashboard
  {id: 1250, name: "MFC-MILLS_SUMORE_1_11", desc: "Мелнично: Разход на руда", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", state: null, maxValue: 2500},
  {id: 2114, name: "MFC_SUM_SHIFTS_1_11", desc: "Мелнично: Преработена руда", unit: "t", precision: 0, group: "Мелнично", icon: "weight", state: null},
  {id: 2135, name: "MFC_SUM_SHIFTSYESTERDAY_1_11", desc: "Мелнично: Преработена руда за предходния ден", unit: "t", precision: 0, group: "Мелнично", icon: "weight", state: null},
];
