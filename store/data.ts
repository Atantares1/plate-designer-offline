import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reaction } from '@/app/type';

// Plate interface
interface Plate {
  id: string;
  name: string;
  isActive: boolean;
}



interface ReactionsState {
  reactions: Reaction[];
  plates: Plate[];
  selectedItems: Set<string>;
  selectedOrder: string[];
  lastSelectedIndex: number;
  defunctWells: Map<string, Set<string>>; 
  ccWells: Map<string, Set<string>>; // Add CC wells state
  previewWells: Set<string>;
  isMultiDrag: boolean;
  
  setReactions: (reactions: Reaction[]) => void;
  updateReaction: (id: string, updates: Partial<Reaction>) => void;
  moveReaction: (id: string, newState: string) => void;
  swapReactions: (id1: string, id2: string) => void;
  moveReactionToPlate: (reactionId: string, plateId: string) => void;
  
  addPlate: () => void;
  renamePlate: (plateId: string, newName: string) => void;
  deletePlate: (plateId: string) => void;
  setActivePlate: (plateId: string) => void;
  getActivePlate: () => Plate | undefined;
  
  setSelectedItems: (items: Set<string>) => void;
  setSelectedOrder: (order: string[]) => void;
  setLastSelectedIndex: (index: number) => void;
  clearSelection: () => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  selectRange: (startIndex: number, endIndex: number) => void;
  
  setDefunctWells: (plateId: string, wells: Set<string>) => void;
  toggleDefunctWell: (plateId: string, position: string) => void;
  getDefunctWellsForPlate: (plateId: string) => Set<string>;
  
  setCCWells: (plateId: string, wells: Set<string>) => void;
  toggleCCWell: (plateId: string, position: string) => void;
  getCCWellsForPlate: (plateId: string) => Set<string>;
  
  setPreviewWells: (wells: Set<string>) => void;
  setIsMultiDrag: (isMulti: boolean) => void;
  
  resetToDefault: () => void;
  getReactionById: (id: string) => Reaction | undefined;
  getReactionAtPosition: (position: string, plateId?: string) => Reaction | undefined;
  getUsedItems: (plateId?: string) => Set<string>;
  getReactionsForPlate: (plateId: string) => Reaction[];
}

export const useReactionsStore = create<ReactionsState>()(
  persist(
    (set, get) => ({
      reactions: [],
      plates: [{
        id: '1',
        name: 'Plate 1',
        isActive: true
      }], // Initialize with a default plate
      selectedItems: new Set(),
      selectedOrder: [],
      lastSelectedIndex: -1,
      defunctWells: new Map(),
      ccWells: new Map(), // Initialize ccWells
      previewWells: new Set(),
      isMultiDrag: false,

      // Actions
      setReactions: (reactions) => set({ reactions }),
      
      updateReaction: (id, updates) => set((state) => ({
        reactions: state.reactions.map(reaction =>
          reaction.id === id ? { ...reaction, ...updates } : reaction
        )
      })),
      
      moveReaction: (id, newState) => set((state) => {
        const activePlate = state.plates.find(plate => plate.isActive);
        let plateId: string | undefined;
        
        if (newState === 'unused') {
          plateId = undefined;
        } else {
          // If no active plate, use the first plate as default
          plateId = activePlate?.id || state.plates[0]?.id;
          
          // If still no plateId, create a default plate
          if (!plateId) {
            const defaultPlate = {
              id: '1',
              name: 'Plate 1',
              isActive: true
            };
            state.plates = [defaultPlate];
            plateId = defaultPlate.id;
          }
        }
        
        return {
          reactions: state.reactions.map(reaction =>
            reaction.id === id ? { ...reaction, state: newState, plateId } : reaction
          )
        };
      }),
      
      swapReactions: (id1, id2) => set((state) => {
        const reaction1 = state.reactions.find(r => r.id === id1);
        const reaction2 = state.reactions.find(r => r.id === id2);
        
        if (!reaction1 || !reaction2) return state;
        
        return {
          reactions: state.reactions.map(reaction => {
            if (reaction.id === id1) {
              return { ...reaction, state: reaction2.state, plateId: reaction2.plateId };
            } else if (reaction.id === id2) {
              return { ...reaction, state: reaction1.state, plateId: reaction1.plateId };
            }
            return reaction;
          })
        };
      }),

      moveReactionToPlate: (reactionId, plateId) => set((state) => ({
        reactions: state.reactions.map(reaction =>
          reaction.id === reactionId ? { ...reaction, plateId } : reaction
        )
      })),

      // Plate management
      addPlate: () => set((state) => {
        // Find the next available ID by checking existing plate IDs
        const existingIds = state.plates.map(plate => parseInt(plate.id)).sort((a, b) => a - b);
        let nextId = 1;
        
        // Find the first gap in the sequence or use the next number after the highest
        for (const id of existingIds) {
          if (id !== nextId) {
            break; // Found a gap, use this number
          }
          nextId++;
        }
        
        const newPlate: Plate = {
          id: nextId.toString(),
          name: `Plate ${nextId}`,
          isActive: false
        };
        
        // Set the new plate as active and deactivate others
        const updatedPlates = state.plates.map(plate => ({ ...plate, isActive: false }));
        updatedPlates.push(newPlate);
        
        // Ensure the first plate is always active if no plate is currently active
        if (!state.plates.some(plate => plate.isActive)) {
          updatedPlates[0].isActive = true;
        }
        
        return { plates: updatedPlates };
      }),

      renamePlate: (plateId, newName) => set((state) => ({
        plates: state.plates.map(plate =>
          plate.id === plateId ? { ...plate, name: newName } : plate
        )
      })),

      deletePlate: (plateId) => set((state) => {
        // Don't delete if it's the only plate
        if (state.plates.length <= 1) return state;
        
        const updatedPlates = state.plates.filter(plate => plate.id !== plateId);
        
        // If we deleted the active plate, make the first remaining plate active
        const wasActive = state.plates.find(plate => plate.id === plateId)?.isActive;
        if (wasActive && updatedPlates.length > 0) {
          updatedPlates[0].isActive = true;
        }
        
        // Free all reactions from deleted plate (set plateId to undefined AND state to 'unused')
        const updatedReactions = state.reactions.map(reaction => {
          if (reaction.plateId === plateId) {
            return { ...reaction, plateId: undefined, state: 'unused' };
          }
          return reaction;
        });
        
        // Remove defunct wells for the deleted plate
        const newDefunctWells = new Map(state.defunctWells);
        newDefunctWells.delete(plateId);
        
        return { 
          plates: updatedPlates,
          reactions: updatedReactions,
          defunctWells: newDefunctWells
        };
      }),

      setActivePlate: (plateId) => set((state) => ({
        plates: state.plates.map(plate => ({
          ...plate,
          isActive: plate.id === plateId
        }))
      })),

      getActivePlate: () => {
        const state = get();
        const activePlate = state.plates.find(plate => plate.isActive);
        // If no active plate, return the first plate as default
        if (activePlate) return activePlate;
        if (state.plates.length > 0) return state.plates[0];
        
        // If somehow there are no plates, create a default one
        const defaultPlate = {
          id: '1',
          name: 'Plate 1',
          isActive: true
        };
        set({ plates: [defaultPlate] });
        return defaultPlate;
      },

      // Selection actions
      setSelectedItems: (items) => set({ selectedItems: items }),
      
      setSelectedOrder: (order) => set({ selectedOrder: order }),
      
      setLastSelectedIndex: (index) => set({ lastSelectedIndex: index }),
      
      clearSelection: () => set({ 
        selectedItems: new Set(), 
        selectedOrder: [], 
        lastSelectedIndex: -1 
      }),
      
      addToSelection: (id) => set((state) => {
        const newSelectedItems = new Set(state.selectedItems);
        newSelectedItems.add(id);
        const newSelectedOrder = state.selectedOrder.includes(id) 
          ? state.selectedOrder 
          : [...state.selectedOrder, id];
        
        return {
          selectedItems: newSelectedItems,
          selectedOrder: newSelectedOrder
        };
      }),
      
      removeFromSelection: (id) => set((state) => {
        const newSelectedItems = new Set(state.selectedItems);
        newSelectedItems.delete(id);
        const newSelectedOrder = state.selectedOrder.filter(itemId => itemId !== id);
        
        return {
          selectedItems: newSelectedItems,
          selectedOrder: newSelectedOrder
        };
      }),
      
      selectRange: (startIndex, endIndex) => set((state) => {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        const rangeIds = state.reactions.slice(start, end + 1).map(r => r.id);
        
        return {
          selectedItems: new Set(rangeIds),
          selectedOrder: rangeIds,
          lastSelectedIndex: endIndex
        };
      }),

      // Well management
      setDefunctWells: (plateId, wells) => set((state) => {
        const newDefunctWells = new Map(state.defunctWells);
        newDefunctWells.set(plateId, wells);
        return { defunctWells: newDefunctWells };
      }),
      
      toggleDefunctWell: (plateId, position) => set((state) => {
        const newDefunctWells = new Map(state.defunctWells);
        const plateWells = new Set(newDefunctWells.get(plateId) || []);
        if (plateWells.has(position)) {
          plateWells.delete(position);
        } else {
          plateWells.add(position);
        }
        newDefunctWells.set(plateId, plateWells);
        return { defunctWells: newDefunctWells };
      }),

      getDefunctWellsForPlate: (plateId) => {
        const state = get();
        return state.defunctWells.get(plateId) || new Set();
      },

      // CC Well management
      setCCWells: (plateId, wells) => set((state) => {
        const newCCWells = new Map(state.ccWells);
        newCCWells.set(plateId, wells);
        return { ccWells: newCCWells };
      }),

      toggleCCWell: (plateId, position) => set((state) => {
        const newCCWells = new Map(state.ccWells);
        const plateWells = new Set(newCCWells.get(plateId) || []);
        if (plateWells.has(position)) {
          plateWells.delete(position);
        } else {
          plateWells.add(position);
        }
        newCCWells.set(plateId, plateWells);
        return { ccWells: newCCWells };
      }),

      getCCWellsForPlate: (plateId) => {
        const state = get();
        return state.ccWells.get(plateId) || new Set();
      },

      // Preview actions
      setPreviewWells: (wells) => set({ previewWells: wells }),
      
      setIsMultiDrag: (isMulti) => set({ isMultiDrag: isMulti }),

      // Utility actions
      resetToDefault: () => set((state) => {
        const defaultPlates = [{
          id: '1',
          name: 'Plate 1',
          isActive: true
        }];
        
        return {
          reactions: [],
          plates: defaultPlates,
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1,
          defunctWells: new Map(),
          ccWells: new Map(), // Reset ccWells
          previewWells: new Set(),
          isMultiDrag: false
        };
      }),
      
      getReactionById: (id) => get().reactions.find(r => r.id === id),
      
      getReactionAtPosition: (position, plateId?: string) => {
        const state = get();
        if (plateId) {
          return state.reactions.find(r => r.state === position && r.plateId === plateId);
        }
        // If no plateId provided, get the active plate or default to first plate
        const activePlate = state.plates.find(plate => plate.isActive);
        let targetPlateId = activePlate?.id || state.plates[0]?.id;
        
        // If still no targetPlateId, create a default plate
        if (!targetPlateId) {
          const defaultPlate = {
            id: '1',
            name: 'Plate 1',
            isActive: true
          };
          state.plates = [defaultPlate];
          targetPlateId = defaultPlate.id;
        }
        
        return state.reactions.find(r => r.state === position && r.plateId === targetPlateId);
      },
      
      getUsedItems: (plateId?: string) => {
        const state = get();
        if (plateId) {
          return new Set(state.reactions.filter(r => r.state !== 'unused' && r.plateId === plateId).map(r => r.id));
        }
        return new Set(state.reactions.filter(r => r.state !== 'unused' && r.plateId !== undefined).map(r => r.id));
      },

      getReactionsForPlate: (plateId) => get().reactions.filter(r => r.plateId === plateId)
    }),
    {
      name: 'reactions-storage',
      partialize: (state) => ({
        reactions: state.reactions,
        plates: state.plates,
        selectedItems: Array.from(state.selectedItems),
        selectedOrder: state.selectedOrder,
        lastSelectedIndex: state.lastSelectedIndex,
        defunctWells: Array.from(state.defunctWells.entries()).map(([key, value]) => [key, Array.from(value)]),
        ccWells: Array.from(state.ccWells.entries()).map(([key, value]) => [key, Array.from(value)]), // Add ccWells to partialize
        previewWells: Array.from(state.previewWells),
        isMultiDrag: state.isMultiDrag
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Sets after rehydration
          state.selectedItems = new Set(state.selectedItems || []);
          // Convert defunctWells back to Map structure
          if (state.defunctWells && Array.isArray(state.defunctWells)) {
            const newDefunctWells = new Map<string, Set<string>>();
            state.defunctWells.forEach(([plateId, wells]: [string, string[]]) => {
              newDefunctWells.set(plateId, new Set(wells));
            });
            state.defunctWells = newDefunctWells;
          } else {
            state.defunctWells = new Map();
          }
          // Convert ccWells back to Map structure
          if (state.ccWells && Array.isArray(state.ccWells)) {
            const newCCWells = new Map<string, Set<string>>();
            state.ccWells.forEach(([plateId, wells]: [string, string[]]) => {
              newCCWells.set(plateId, new Set(wells));
            });
            state.ccWells = newCCWells;
          } else {
            state.ccWells = new Map();
          }
          state.previewWells = new Set(state.previewWells || []);
        }
      }
    }
  )
);

