export * from './types';
export * from './dashboard-tags';

// Utility functions to work with tags
export const getTagById = (id: number) => {
  const { dashboardTags } = require('./dashboard-tags');
  return dashboardTags.find((tag: any) => tag.id === id);
};

export const getTagByName = (name: string) => {
  const { dashboardTags } = require('./dashboard-tags');
  return dashboardTags.find((tag: any) => tag.name === name);
};

export const getTagGroups = (): string[] => {
  const { dashboardTags } = require('./dashboard-tags');
  // Extract all unique groups
  const allGroups = [...new Set(dashboardTags.map((tag: any) => tag.group))];
  
  // Make sure КЕТ1 is included by ensuring it's added if it exists in any tag
  let hasKET1 = false;
  for (const tag of dashboardTags) {
    if (tag.group === "КЕТ1") {
      hasKET1 = true;
      break;
    }
  }
  
  // Force КЕТ1 to be included if it exists in tags but wasn't captured
  if (hasKET1 && !allGroups.includes("КЕТ1")) {
    allGroups.push("КЕТ1");
  }
  
  return allGroups as string[];
};

export const getTagsByGroup = (group: string) => {
  const { dashboardTags } = require('./dashboard-tags');
  return dashboardTags.filter((tag: any) => tag.group === group);
};
