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

export const getTagGroups = () => {
  const { dashboardTags } = require('./dashboard-tags');
  return [...new Set(dashboardTags.map((tag: any) => tag.group))];
};

export const getTagsByGroup = (group: string) => {
  const { dashboardTags } = require('./dashboard-tags');
  return dashboardTags.filter((tag: any) => tag.group === group);
};
