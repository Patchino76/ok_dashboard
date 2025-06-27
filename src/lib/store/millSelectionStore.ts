import { create } from 'zustand';

interface MillSelectionState {
  // Selected mills record (millName -> boolean)
  selectedMills: Record<string, boolean>;
  
  // Status of all mills selected toggle
  allSelected: boolean;
  
  // Actions
  toggleMill: (millName: string) => void;
  toggleAllMills: () => void;
  initializeMills: (millNames: string[]) => void;
}

export const useMillSelectionStore = create<MillSelectionState>((set) => ({
  selectedMills: {},
  allSelected: false,
  
  toggleMill: (millName) => set((state) => {
    const newSelectedMills = {
      ...state.selectedMills,
      [millName]: !state.selectedMills[millName]
    };
    
    // Check if all mills are now selected
    const allSelected = Object.values(newSelectedMills).every(selected => selected);
    
    return { 
      selectedMills: newSelectedMills,
      allSelected
    };
  }),
  
  toggleAllMills: () => set((state) => {
    const newState = !state.allSelected;
    const newSelectedMills = {...state.selectedMills};
    
    // Set all mills to the new selection state
    Object.keys(state.selectedMills).forEach(millName => {
      newSelectedMills[millName] = newState;
    });
    
    return { 
      selectedMills: newSelectedMills,
      allSelected: newState
    };
  }),
  
  initializeMills: (millNames) => set(() => {
    const initialSelections: Record<string, boolean> = {};
    
    // Set all mills except Mill 11 to be selected by default
    millNames.forEach(millName => {
      // Check if this is Mill 11 (various formats might be used)
      const isMill11 = millName.includes('11') || millName.toUpperCase() === 'MILL_11';
      initialSelections[millName] = !isMill11;
    });
    
    // Check if all mills are initially selected
    const allSelected = millNames.every(millName => initialSelections[millName]);
    
    return {
      selectedMills: initialSelections,
      allSelected
    };
  }),
}));
