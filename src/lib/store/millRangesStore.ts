import { create } from 'zustand';

interface MillRangesState {
  // Range values as percentages relative to mean
  lowThreshold: number;  // Default: 20% below mean
  highThreshold: number; // Default: 20% above mean
  
  // Colors for each range
  lowColor: string;
  yellowColor: string;
  highColor: string;
  
  // Actions
  setLowThreshold: (value: number) => void;
  setHighThreshold: (value: number) => void;
  setLowColor: (color: string) => void;
  setYellowColor: (color: string) => void;
  setHighColor: (color: string) => void;
  
  // Helper function to calculate thresholds based on actual data
  calculateThresholds: (millValues: number[]) => { low: number, high: number };
}

export const useMillRangesStore = create<MillRangesState>((set, get) => ({
  // Default values as percentages relative to mean
  lowThreshold: -20, // 20% below mean
  highThreshold: 20, // 20% above mean
  
  // Default colors
  lowColor: '#ef4444', // Red
  yellowColor: '#f59e0b', // Yellow/Amber
  highColor: '#10b981', // Green
  
  // Actions for updating thresholds
  setLowThreshold: (value) => set({ lowThreshold: value }),
  setHighThreshold: (value) => set({ highThreshold: value }),
  
  // Actions for updating colors
  setLowColor: (color) => set({ lowColor: color }),
  setYellowColor: (color) => set({ yellowColor: color }),
  setHighColor: (color) => set({ highColor: color }),
  
  // Calculate actual threshold values based on mill values
  calculateThresholds: (millValues) => {
    if (!millValues || millValues.length === 0) {
      return { low: 0, high: 0 };
    }
    
    // Calculate mean of all values
    const sum = millValues.reduce((acc, value) => acc + value, 0);
    const mean = sum / millValues.length;
    
    // Get current percentage thresholds
    const { lowThreshold, highThreshold } = get();
    
    // Calculate actual thresholds based on percentages
    const low = mean * (1 + lowThreshold / 100);
    const high = mean * (1 + highThreshold / 100);
    
    return { low, high };
  }
}));
