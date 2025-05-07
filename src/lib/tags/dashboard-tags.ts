import { TagDefinition } from './types';

export const dashboardTags: TagDefinition[] = [
  // Dispatcher Metrics
  {id: 1001, name: "DISP_SHIFT1_PERFORMANCE", desc: "Shift 1: Performance", unit: "%", group: "Dispatcher", icon: "activity", state: null},
  {id: 1002, name: "DISP_SHIFT2_PERFORMANCE", desc: "Shift 2: Performance", unit: "%", group: "Dispatcher", icon: "activity", state: null},
  {id: 1003, name: "DISP_SHIFT3_PERFORMANCE", desc: "Shift 3: Performance", unit: "%", group: "Dispatcher", icon: "activity", state: null},
  {id: 1004, name: "DISP_CURRENT_DAY_AVG", desc: "Current Day Average", unit: "%", group: "Dispatcher", icon: "percent", state: null},
  {id: 1005, name: "DISP_WEEKLY_AVG", desc: "Weekly Average", unit: "%", group: "Dispatcher", icon: "bar-chart", state: null},
  {id: 1006, name: "DISP_MONTHLY_AVG", desc: "Monthly Average", unit: "%", group: "Dispatcher", icon: "trending-up", state: null},

  // Dispatcher Efficiency
  {id: 2001, name: "DISP_EFF_JAN", desc: "January Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2002, name: "DISP_EFF_FEB", desc: "February Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2003, name: "DISP_EFF_MAR", desc: "March Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2004, name: "DISP_EFF_APR", desc: "April Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2005, name: "DISP_EFF_MAY", desc: "May Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2006, name: "DISP_EFF_JUN", desc: "June Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2007, name: "DISP_EFF_JUL", desc: "July Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2008, name: "DISP_EFF_AUG", desc: "August Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2009, name: "DISP_EFF_SEP", desc: "September Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2010, name: "DISP_EFF_OCT", desc: "October Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2011, name: "DISP_EFF_NOV", desc: "November Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},
  {id: 2012, name: "DISP_EFF_DEC", desc: "December Efficiency", unit: "%", group: "Monthly", icon: "calendar", state: null},

  // Team Performance
  {id: 3001, name: "TEAM_A_PERFORMANCE", desc: "Team A Performance", unit: "%", group: "Teams", icon: "users", state: null},
  {id: 3002, name: "TEAM_B_PERFORMANCE", desc: "Team B Performance", unit: "%", group: "Teams", icon: "users", state: null},
  {id: 3003, name: "TEAM_C_PERFORMANCE", desc: "Team C Performance", unit: "%", group: "Teams", icon: "users", state: null},
  {id: 3004, name: "TEAM_D_PERFORMANCE", desc: "Team D Performance", unit: "%", group: "Teams", icon: "users", state: null},

  // KPIs
  {id: 4001, name: "KPI_RESPONSE_TIME", desc: "Response Time", unit: "min", group: "KPIs", icon: "clock", state: null},
  {id: 4002, name: "KPI_ISSUES_RESOLVED", desc: "Issues Resolved", unit: "count", group: "KPIs", icon: "check-circle", state: null},
  {id: 4003, name: "KPI_ATTENDANCE", desc: "Attendance Rate", unit: "%", group: "KPIs", icon: "user-check", state: null},
  {id: 4004, name: "KPI_SHIFT_HANDOVER", desc: "Shift Handover Quality", unit: "score", group: "KPIs", icon: "repeat", state: null},
];
