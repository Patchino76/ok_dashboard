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
  ore: [
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
  ]
};

// Mills dashboard tags for reference in the dashboard and KPI components
export const millsDashboardTags: TagDefinition[] = [
  // Mill summary tags for the dashboard
  {id: 1250, name: "MFC-MILLS_SUMORE_1_11", desc: "Мелнично: Разход на руда", unit: "t/h", precision: 0, group: "Мелнично", icon: "conveyer", state: null, maxValue: 2500},
  {id: 2114, name: "MFC_SUM_SHIFTS_1_11", desc: "Мелнично: Преработена руда", unit: "t", precision: 0, group: "Мелнично", icon: "weight", state: null},
  {id: 2135, name: "MFC_SUM_SHIFTSYESTERDAY_1_11", desc: "Мелнично: Преработена руда за предходния ден", unit: "t", precision: 0, group: "Мелнично", icon: "weight", state: null},
];
