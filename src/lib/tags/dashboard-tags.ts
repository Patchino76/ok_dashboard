import { TagDefinition } from './types';

export const dashboardTags: TagDefinition[] = [
  // KET1
  {id: 1056, name: "KET1_START_KKD", desc: "КET1: KKD старт / стоп", unit: "bool", group: "KET1", icon: null, state: null},
  {id: 770, name: "KET1_START_KRD1", desc: "КET1: KRD1 старт / стоп", unit: "bool", group: "KET1", icon: null, state: null},
  {id: 1057, name: "KET1_START_KRD2", desc: "КET1: KRD2 старт / стоп", unit: "bool", group: "KET1", icon: null, state: null},
  {id: 774, name: "KET1_FB_GTL1", desc: "КET1: ГТЛ1 старт / стоп", unit: "bool", group: "KET1", icon: null, state: null},
  {id: 775, name: "KET1_FB_GTL2", desc: "КET1: ГТЛ2 старт / стоп", unit: "bool", group: "KET1", icon: null, state: null},
  {id: 11, name: "KET1_CURRENT_WEIGHT_SCALE_GTL1", desc: "КET1: ГТЛ1 - разход на руда", unit: "t/h", group: "KET1", icon: "conveyer", state: ["KET1_FB_GTL1"]},
  {id: 12, name: "KET1_CURRENT_WEIGHT_SCALE_GTL2", desc: "КET1: ГТЛ2 - разход на руда", unit: "t/h", group: "KET1", icon: "conveyer", state: ["KET1_FB_GTL2"]},
  {id: 13, name: "KET1_POWER_KKD_KRU", desc: "КET1: ККД мощност на трошачка", unit: "kW", group: "KET1", icon: "crusher", state: ["KET1_START_KKD"]},
  {id: 1598, name: "KET1_CURRENT_MATERIAL_WEIGHT", desc: "КET1: Тотал разход на руда", unit: "t/h", group: "KET1", icon: "conveyer", state: ["KET1_FB_GTL1", "KET1_FB_GTL2"]},
  {id: 229, name: "KET1_CURRENT_DAILY_QUANTITY", desc: "КET1: Тотал преработена руда", unit: "t", group: "KET1", icon: "weight", state: null},
  
  // KET3
  {id: 1063, name: "KET3_FB_ALLIS", desc: "КET3: ГТЛ27 ALLIS старт / стоп", unit: "bool", group: "KET3", icon: null, state: null},
  {id: 779, name: "KET3_FB_TFK", desc: "КET3: ГТЛ45 TFK Старт / Стоп", unit: "bool", group: "KET3", icon: null, state: null},
  {id: 38, name: "KET3_BELT_SCALE_GTL27", desc: "КET3: ГТЛ27 ALLIS разход на руда", unit: "t/h", group: "KET3", icon: "conveyer", state: ["KET3_FB_ALLIS"]},
  {id: 230, name: "KET3_BELT_SCALE_GTL45", desc: "КET3: ГТЛ45 TFK разход на руда", unit: "t/h", group: "KET3", icon: "conveyer", state: ["KET3_FB_TFK"]},
  {id: 1191, name: "KET3_SUM_BELT_SCALE27_45", desc: "КET3: ГТЛ570 разход на руда", unit: "t/h", group: "KET3", icon: "conveyer", state: ["KET3_FB_ALLIS", "KET3_FB_TFK"]},
  {id: 231, name: "KET3_CURRENT_DAILY_QUANTITY", desc: "КET3: Тотал преработена руда", unit: "t", group: "KET3", icon: "weight", state: null},
  
  // KET
  {id: 1525, name: "KET_SUM_BELT_CURRENT_QUANTITY", desc: "КET: Тотал преработена руда", unit: "t", group: "KET", icon: "weight", state: null},
  {id: 3731, name: "KET1_WAREHOUSE1_LEVEL", desc: "Открит склад 1: - кота", unit: "m", group: "KET", icon: "pile", state: null},
  {id: 4661, name: "KET1_WAREHOUSE1_LEVEL1", desc: "Открит склад 1: - ниво", unit: "m", group: "KET", icon: "pile", state: null},
  
  // MGTL
  {id: 1715, name: "MGTL-TBM230-BELT-RUNNING", desc: "МГТЛ: старт / стоп", unit: "bool", group: "MGTL", icon: "weight", state: null},
  {id: 3671, name: "MGTL-TBM230-CURRENT-TON-PH", desc: "МГТЛ разход на руда", unit: "t/h", group: "MGTL", icon: "conveyer", state: ["MGTL-TBM230-BELT-RUNNING"]},
  {id: 1714, name: "MGTL-TBM230-SHIFT-TONS", desc: "МГТЛ: преминала руда", unit: "t", group: "MGTL", icon: "weight", state: null},
  {id: 3067, name: "SST_NIVO_OTKRIT_SLAD_2", desc: "Открит склад 2: - ниво", unit: "m", group: "MGTL", icon: "pile", state: null},
  
  // SST - Balance
  {id: 1192, name: "SST_SUM_POTOK_1_4", desc: "ССТ - Вход", unit: "t/h", group: "SST", icon: "conveyer", state: ["SST_FB_UPPER_SCREEN_STR1"]},
  
  // Stream_1-4
  {id: 1854, name: "SST_FB_UPPER_SCREEN_STR1", desc: "ПОТОК 1: горно сито старт / стоп", unit: "bool", group: "Stream_1-4", icon: null, state: null},
  {id: 1855, name: "SST_FB_UPPER_SCREEN_STR2", desc: "ПОТОК 2: горно сито старт / стоп", unit: "bool", group: "Stream_1-4", icon: null, state: null},
  {id: 1856, name: "SST_FB_UPPER_SCREEN_STR3", desc: "ПОТОК 3: горно сито старт / Стоп", unit: "bool", group: "Stream_1-4", icon: null, state: null},
  {id: 1858, name: "SST_FB_UPPER_SCREEN_STR4", desc: "ПОТОК 4: горно сито старт / Стоп", unit: "bool", group: "Stream_1-4", icon: null, state: null},

  {id: 87, name: "SST_WEIGHT_SCALE_STR1", desc: "ПОТОК 1: ДЛ разход на руда", unit: "t/h", group: "Stream_1-4", icon: "conveyer", state: ["SST_FB_UPPER_SCREEN_STR1"]},
  {id: 101, name: "SST_WEIGHT_SCALE_STR2", desc: "ПОТОК 2: ДЛ разход на руда", unit: "t/h", group: "Stream_1-4", icon: "conveyer", state: ["SST_FB_UPPER_SCREEN_STR2"]},
  {id: 115, name: "SST_WEIGHT_SCALE_STR3", desc: "ПОТОК 3: ДЛ разход на руда", unit: "t/h", group: "Stream_1-4", icon: "conveyer", state: ["SST_FB_UPPER_SCREEN_STR3"]},
  {id: 129, name: "SST_WEIGHT_SCALE_STR4", desc: "ПОТОК 4: ДЛ разход на руда", unit: "t/h", group: "Stream_1-4", icon: "conveyer", state: ["SST_FB_UPPER_SCREEN_STR4"]},

  {id: 86, name: "SST_POWER_CRUSHER_MOTOR_STR1", desc: "ПОТОК 1: мощност на трошачка", unit: "kW", group: "Stream_1-4", icon: "crusher", state: ["SST_FB_UPPER_SCREEN_STR1"]},
  {id: 100, name: "SST_POWER_CRUSHER_MOTOR_STR2", desc: "ПОТОК 2: мощност на трошачка", unit: "kW", group: "Stream_1-4", icon: "crusher", state: ["SST_FB_UPPER_SCREEN_STR2"]},
  {id: 114, name: "SST_POWER_CRUSHER_MOTOR_STR3", desc: "ПОТОК 3: мощност на трошачка", unit: "kW", group: "Stream_1-4", icon: "crusher", state: ["SST_FB_UPPER_SCREEN_STR3"]},
  {id: 128, name: "SST_POWER_CRUSHER_MOTOR_STR4", desc: "ПОТОК 4: мощност на трошачка", unit: "kW", group: "Stream_1-4", icon: "crusher", state: ["SST_FB_UPPER_SCREEN_STR4"]},

  // Stream_5-13
  {id: 911, name: "SST_FB_SCREEN_STR5", desc: "ПОТОК 5: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 923, name: "SST_FB_SCREEN_STR6", desc: "ПОТОК 6: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 937, name: "SST_FB_ROLLCRUSHER_STR6", desc: "ПОТОК 6: валцова трошачка старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 939, name: "SST_FB_SCREEN_STR7", desc: "ПОТОК 7: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 953, name: "SST_FB_SCREEN_STR8", desc: "ПОТОК 8: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 967, name: "SST_FB_SCREEN_STR9", desc: "ПОТОК 9: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 981, name: "SST_FB_SCREEN_STR10", desc: "ПОТОК 10: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 995, name: "SST_FB_SCREEN_STR11", desc: "ПОТОК 11: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 1000, name: "SST_FB_SCREEN_STR12", desc: "ПОТОК 12: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},
  {id: 1006, name: "SST_FB_SCREEN_STR13", desc: "ПОТОК 13: долно сито старт / стоп", unit: "bool", group: "Stream_5-13", icon: null, state: null},

  {id: 136, name: "SST_POWER_CRUSHER_MOTOR_STR5", desc: "ПОТОК 5: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR5"]},
  {id: 142, name: "SST_POWER_CRUSHER_MOTOR_STR6", desc: "ПОТОК 6: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR6"]},
  {id: 150, name: "SST_POWER_CRUSHER_MOTOR_STR7", desc: "ПОТОК 7: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR7"]},
  {id: 156, name: "SST_POWER_CRUSHER_MOTOR_STR8", desc: "ПОТОК 8: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR8"]},
  {id: 162, name: "SST_POWER_CRUSHER_MOTOR_STR9", desc: "ПОТОК 9: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR9"]},
  {id: 5169, name: "SST_ACTUAL_POWER_CR_MOT_STR10", desc: "ПОТОК 10: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR10"]},
  {id: 5008, name: "SST_POWER_CRUSHER_MOTOR_STR11", desc: "ПОТОК 11: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR11"]},
  {id: 5225, name: "SST_POWER_CRUSHER_MOTOR_STR12", desc: "ПОТОК 12: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR12"]},
  {id: 4984, name: "SST_ACTUAL_POWER_CR_MOT_STR13", desc: "ПОТОК 13: мощност на трошачка", unit: "kW", group: "Stream_5-13", icon: "crusher", state: ["SST_FB_SCREEN_STR13"]},

  {id: 5226, name: "SST8-9_POTOK_L5", desc: "ПОТОК 5: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5227, name: "SST8-9_POTOK_L6", desc: "ПОТОК 6: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5228, name: "SST8-9_POTOK_L7", desc: "ПОТОК 7: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5229, name: "SST8-9_POTOK_L8", desc: "ПОТОК 8: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5230, name: "SST8-9_POTOK_L9", desc: "ПОТОК 9: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5231, name: "SST8-9_POTOK_L10", desc: "ПОТОК 10: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5232, name: "SST8-9_POTOK_L11", desc: "ПОТОК 11: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5233, name: "SST8-9_POTOK_L12", desc: "ПОТОК 12: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},
  {id: 5234, name: "SST8-9_POTOK_L13", desc: "ПОТОК 13: ниво", unit: "m", group: "Stream_5-13", icon: "level", state: null},

  // Stream_15
  {id: 1012, name: "SST_FB_SST5_STR15", desc: "ПОТОК 15: ГТЛ5 старт / стоп", unit: "bool", group: "Stream_15", icon: null, state: null},
  {id: 1013, name: "SST_FB_SST6_STR15", desc: "ПОТОК 15: ГТЛ6 старт / стоп", unit: "bool", group: "Stream_15", icon: null, state: null},
  {id: 191, name: "SST_WEIGHT_SCALE_MB1_STR15", desc: "ПОТОК 15: разход на руда", unit: "t/h", group: "Stream_15", icon: "conveyer", state: ["SST_FB_SST5_STR15", "SST_FB_SST6_STR15"]},
  {id: 1339, name: "SST5_SHIFT1_3_MB1", desc: "ПОТОК 15: Тотал преработена руда", unit: "t", group: "Stream_15", icon: "weight", state: null},

  // Stream_16
  {id: 1024, name: "SST_CB_ON_PV1_STR16", desc: "ПОТОК 16: ПВ1 старт / стоп", unit: "bool", group: "Stream_16", icon: null, state: null},
  {id: 206, name: "SST_WEIGHT_SCALE_SST7_STR16", desc: "ПОТОК 16: разход на руда", unit: "t/h", group: "Stream_16", icon: "conveyer", state: ["SST_CB_ON_PV1_STR16"]},
  {id: 1337, name: "SST5_SHIFT1_3_P1_4", desc: "ПОТОК 16: Тотал преработена руда", unit: "t", group: "Stream_16", icon: "weight", state: null},

  // Bunkers
  {id: 3594, name: "SST_SUM_MB2_1_10_AVG", desc: "Междинни бункери: средно ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1252, name: "SST-MB2_TML1", desc: "Междинен Бункер 1: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1253, name: "SST-MB2_TML2", desc: "Междинен Бункер 2: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1254, name: "SST-MB2_TML3", desc: "Междинен Бункер 3: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1255, name: "SST-MB2_TML4", desc: "Междинен Бункер 4: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1256, name: "SST-MB2_TML5", desc: "Междинен Бункер 5: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1257, name: "SST-MB2_TML6", desc: "Междинен Бункер 6: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1258, name: "SST-MB2_TML7", desc: "Междинен Бункер 7: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1259, name: "SST-MB2_TML8", desc: "Междинен Бункер 8: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1260, name: "SST-MB2_TML9", desc: "Междинен Бункер 9: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 1261, name: "SST-MB2_TML10", desc: "Междинен Бункер 10: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  {id: 3836, name: "SST-MB2_TML12", desc: "Междинен Бункер 12: ниво", unit: "m", group: "Bunkers", icon: "level", state: null},
  
  // Mills
  {id: 1250, name: "MFC-MILLS_SUMORE_1_11", desc: "Мелнично: Разход на руда", unit: "t/h", group: "mills", icon: "conveyer", state: null},
  {id: 2114, name: "MFC_SUM_SHIFTS_1_11", desc: "Мелнично: Преработена руда", unit: "t", group: "mills", icon: "weight", state: null},
  {id: 2135, name: "MFC_SUM_SHIFTSYESTERDAY_1_11", desc: "Мелнично: Преработена руда за предходния ден", unit: "t", group: "mills", icon: "weight", state: null},
  
  // Flotation
  {id: 3288, name: "RECOVERY_LINEALL_CU_LONG", desc: "Общo извличане", unit: "% Cu", group: "Flotation", icon: "flotaion", state: null},
  {id: 1435, name: "CUFLOTAS2-S7-400PV_CU_LINE_7", desc: "Захранване флотация", unit: "% Cu", group: "Flotation", icon: "flotaion", state: null},
  {id: 1600, name: "CUFLOTAS2-S7-400PV_CU_LINE_6", desc: "Краен отпадък", unit: "% Cu", group: "Flotation", icon: "Flotation", state: null},
  {id: 1438, name: "CUFLOTAS2-S7-400PV_CU_LINE_10", desc: "Технологичен концентрат", unit: "% Cu", group: "Flotation", icon: "flotaion", state: null},
  
  // FilterPress
  {id: 553, name: "FP-AB_LC1_TOTALWEIGHT-PREVIOUSDAY", desc: "Филтър преси - преработка", unit: "t/ден", group: "Filter", icon: "filterpress", state: null},
  
  // TruckScale
  {id: 1440, name: "SCALES-OK_CUCONC_CURRENT_DAY_OUT", desc: "Автомобилна везна - концентрат", unit: "t/ден", group: "AutoScale", icon: "truck", state: null},
  
  // WaterPark
  {id: 450, name: "WATERPARK-VHS_RADIN_IZVOR_FT601", desc: "ВХС - Свежа вода", unit: "l/s", group: "WaterPark", icon: "waterflow", state: null},
  {id: 447, name: "VHS8_KISELA_VODA_FT801", desc: "ВХС - Руднична вода", unit: "l/s", group: "WaterPark", icon: "waterflow", state: null},
];
