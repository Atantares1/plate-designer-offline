import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reaction } from '@/app/type';

// Plate interface
interface Plate {
  id: string;
  name: string;
  isActive: boolean;
}

// Reaction list interface
interface ReactionList {
  id: string;
  name: string;
  isActive: boolean;
  reactions: Reaction[];
  order: string[]; // Custom ordering for this list
}

interface ReactionsState {
  reactionLists: ReactionList[];
  plates: Plate[];
  selectedItems: Set<string>;
  selectedOrder: string[];
  lastSelectedIndex: number;
  defunctWells: Map<string, Set<string>>; 
  ccWells: Map<string, Set<string>>; // Add CC wells state
  previewWells: Set<string>;
  isMultiDrag: boolean;
  
  // Reaction list management
  addReactionList: (name?: string) => void;
  removeReactionList: (listId: string) => void;
  setActiveReactionList: (listId: string) => void;
  getActiveReactionList: () => ReactionList | undefined;
  renameReactionList: (listId: string, newName: string) => boolean;
  
  // Reaction management within lists
  setReactions: (reactions: Reaction[], listId?: string) => void;
  addReactionsToList: (reactions: Reaction[], listId?: string) => void;
  updateReaction: (id: string, updates: Partial<Reaction>) => void;
  moveReaction: (id: string, newState: string) => void;
  swapReactions: (id1: string, id2: string) => void;
  moveReactionToPlate: (reactionId: string, plateId: string) => void;
  
  // List-specific ordering
  setListOrder: (listId: string, order: string[]) => void;
  reorderReactionInList: (listId: string, reactionId: string, newIndex: number) => void;
  
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
  
  // Get all reactions from all lists
  getAllReactions: () => Reaction[];
  
     // Get reactions from a specific list
   getReactionsFromList: (listId: string) => Reaction[];
   
   // Get a specific reaction list by ID
   getReactionListById: (listId: string) => ReactionList | undefined;
}

export const useReactionsStore = create<ReactionsState>()(
  persist(
    (set, get) => ({
             reactionLists: [{
         id: '1',
         name: '1',
         isActive: true,
         reactions: [],
         order: []
       }],
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

      // Reaction list management
                   addReactionList: (name) => set((state) => {
        // Find the next available number by checking existing names
        const existingNumbers = state.reactionLists
          .map(list => {
            const match = list.name.match(/^(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(num => num > 0)
          .sort((a, b) => a - b);
        
        let nextNumber = 1;
        for (const num of existingNumbers) {
          if (num === nextNumber) {
            nextNumber++;
          } else {
            break; // Found a gap, use this number
          }
        }
        
        // Find the next available ID by checking existing IDs
        const existingIds = state.reactionLists
          .map(list => parseInt(list.id))
          .filter(num => !isNaN(num))
          .sort((a, b) => a - b);
        
        let nextId = 1;
        for (const id of existingIds) {
          if (id === nextId) {
            nextId++;
          } else {
            break; // Found a gap, use this ID
          }
        }
        
        const newName = name || nextNumber.toString();
        
        const newList: ReactionList = {
          id: nextId.toString(),
          name: newName,
          isActive: false,
          reactions: [],
          order: []
        };
        
        // Set the new list as active and deactivate others
        const updatedLists = state.reactionLists.map(list => ({ ...list, isActive: false }));
        updatedLists.push(newList);
        
        return { reactionLists: updatedLists };
      }),

      removeReactionList: (listId) => set((state) => {
        if (state.reactionLists.length <= 1) return state; // Don't delete if it's the only list
        
        const updatedLists = state.reactionLists.filter(list => list.id !== listId);
        
        // If we deleted the active list, make the first remaining list active
        const wasActive = state.reactionLists.find(list => list.id === listId)?.isActive;
        if (wasActive && updatedLists.length > 0) {
          updatedLists[0].isActive = true;
        }
        
        return { reactionLists: updatedLists };
      }),

      setActiveReactionList: (listId) => set((state) => ({
        reactionLists: state.reactionLists.map(list => ({
          ...list,
          isActive: list.id === listId
        }))
      })),

      getActiveReactionList: () => {
        const state = get();
        const activeList = state.reactionLists.find(list => list.isActive);
        if (activeList) return activeList;
        if (state.reactionLists.length > 0) return state.reactionLists[0];
        
         const defaultList = {
           id: '1',
           name: '1',
           isActive: true,
           reactions: [],
           order: []
         };
        set({ reactionLists: [defaultList] });
        return defaultList;
      },

                   renameReactionList: (listId, newName) => {
        const state = get();
        
        const nameExists = state.reactionLists.some(list => 
          list.id !== listId && list.name === newName
        );
        
        if (nameExists) {
          return false;
        }
        
        set((state) => ({
          reactionLists: state.reactionLists.map(list =>
            list.id === listId ? { ...list, name: newName } : list
          )
        }));
        
        return true; 
      },


      setListOrder: (listId, order) => set((state) => ({
        reactionLists: state.reactionLists.map(list =>
          list.id === listId ? { ...list, order } : list
        )
      })),

      reorderReactionInList: (listId, reactionId, newIndex) => set((state) => {
        const list = state.reactionLists.find(l => l.id === listId);
        if (!list) return state;
        
        const currentOrder = [...list.order];
        const currentIndex = currentOrder.indexOf(reactionId);
        
        if (currentIndex === -1) return state;
        
        // Remove from current position and insert at new position
        currentOrder.splice(currentIndex, 1);
        currentOrder.splice(newIndex, 0, reactionId);
        
        return {
          reactionLists: state.reactionLists.map(l =>
            l.id === listId ? { ...l, order: currentOrder } : l
          )
        };
      }),

      setReactions: (reactions, listId) => set((state) => {
        const targetListId = listId || state.reactionLists.find(list => list.isActive)?.id || '1';
        
        const allReactions = state.reactionLists.flatMap(list => list.reactions);
        const duplicateSamples = new Map<string, string[]>();
        
        reactions.forEach(reaction => {
          if (reaction.name) {
            const existingReactions = allReactions.filter(r => 
              r.name === reaction.name && r.id !== reaction.id
            );
            if (existingReactions.length > 0) {
              const listNames = existingReactions.map(r => {
                const list = state.reactionLists.find(l => l.reactions.some(r2 => r2.id === r.id));
                return list?.name || 'Unknown';
              });
              duplicateSamples.set(reaction.name, listNames);
            }
          }
        });
        
        if (duplicateSamples.size > 0) {
          const errorDetails = Array.from(duplicateSamples.entries())
            .map(([sampleName, listNames]) => 
              `Sample "${sampleName}" already exists!!`
            )
            .join('\n');
          throw new Error(`Duplicate sample names detected:\n${errorDetails}`);
        }
        
        return {
          reactionLists: state.reactionLists.map(list =>
            list.id === targetListId 
              ? { 
                  ...list, 
                  reactions, 
                  order: reactions.map(r => r.id) 
                }
              : list
          )
        };
      }),

      addReactionsToList: (reactions, listId) => set((state) => {
        const targetListId = listId || state.reactionLists.find(list => list.isActive)?.id || '1';
        
        return {
          reactionLists: state.reactionLists.map(list =>
            list.id === targetListId 
              ? { 
                  ...list, 
                  reactions: [...list.reactions, ...reactions],
                  order: [...list.order, ...reactions.map(r => r.id)]
                }
              : list
          )
        };
      }),
      
      updateReaction: (id, updates) => set((state) => ({
        reactionLists: state.reactionLists.map(list => ({
          ...list,
          reactions: list.reactions.map(reaction =>
            reaction.id === id ? { ...reaction, ...updates } : reaction
          )
        }))
      })),
      
      moveReaction: (id, newState) => set((state) => {
        const activePlate = state.plates.find(plate => plate.isActive);
        let plateId: string | undefined;
        
        if (newState === 'unused') {
          plateId = undefined;
        } else {
          plateId = activePlate?.id || state.plates[0]?.id;
          
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
          reactionLists: state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.id === id ? { ...reaction, state: newState, plateId } : reaction
            )
          }))
        };
      }),
      
      swapReactions: (id1, id2) => set((state) => {
        const reaction1 = state.reactionLists.flatMap(list => list.reactions).find(r => r.id === id1);
        const reaction2 = state.reactionLists.flatMap(list => list.reactions).find(r => r.id === id2);
        
        if (!reaction1 || !reaction2) return state;
        
        return {
          reactionLists: state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction => {
              if (reaction.id === id1) {
                return { ...reaction, state: reaction2.state, plateId: reaction2.plateId };
              } else if (reaction.id === id2) {
                return { ...reaction, state: reaction1.state, plateId: reaction1.plateId };
              }
              return reaction;
            })
          }))
        };
      }),

      moveReactionToPlate: (reactionId, plateId) => set((state) => ({
        reactionLists: state.reactionLists.map(list => ({
          ...list,
          reactions: list.reactions.map(reaction =>
            reaction.id === reactionId ? { ...reaction, plateId } : reaction
          )
        }))
      })),

      // Plate management
                   addPlate: () => set((state) => {
        // Find the next available number by checking existing names
        const existingNumbers = state.plates
          .map(plate => {
            const match = plate.name.match(/Plate (\d+)/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(num => num > 0)
          .sort((a, b) => a - b);
        
        let nextNumber = 1;
        for (const num of existingNumbers) {
          if (num === nextNumber) {
            nextNumber++;
          } else {
            break; // Found a gap, use this number
          }
        }
        
        // Find the next available ID by checking existing IDs
        const existingIds = state.plates
          .map(plate => parseInt(plate.id))
          .filter(num => !isNaN(num))
          .sort((a, b) => a - b);
        
        let nextId = 1;
        for (const id of existingIds) {
          if (id === nextId) {
            nextId++;
          } else {
            break; // Found a gap, use this ID
          }
        }
        
        const newPlate: Plate = {
          id: nextId.toString(),
          name: `Plate ${nextNumber}`,
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

             renamePlate: (plateId, newName) => set((state) => {
         // Check if the new name already exists (excluding the current plate)
         const nameExists = state.plates.some(plate => 
           plate.id !== plateId && plate.name === newName
         );
         
         if (nameExists) {
           // Find the next available number for this name
           const existingNumbers = state.plates
             .filter(plate => plate.id !== plateId)
             .map(plate => {
               const match = plate.name.match(new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: (\\d+))?$`));
               return match ? (match[1] ? parseInt(match[1]) : 1) : 0;
             })
             .filter(num => num > 0)
             .sort((a, b) => a - b);
           
           let nextNumber = 1;
           for (const num of existingNumbers) {
             if (num === nextNumber) {
               nextNumber++;
             } else {
               break; // Found a gap, use this number
             }
           }
           
           newName = `${newName} ${nextNumber}`;
         }
         
         return {
           plates: state.plates.map(plate =>
             plate.id === plateId ? { ...plate, name: newName } : plate
           )
         };
       }),

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
        const updatedReactionLists = state.reactionLists.map(list => ({
          ...list,
          reactions: list.reactions.map(reaction => {
            if (reaction.plateId === plateId) {
              return { ...reaction, plateId: undefined, state: 'unused' };
            }
            return reaction;
          })
        }));
        
        // Remove defunct wells for the deleted plate
        const newDefunctWells = new Map(state.defunctWells);
        newDefunctWells.delete(plateId);
        
        return { 
          plates: updatedPlates,
          reactionLists: updatedReactionLists,
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
        const rangeIds = state.reactionLists.flatMap(list => list.reactions).slice(start, end + 1).map(r => r.id);
        
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
                 const defaultLists = [{
           id: '1',
           name: '1',
           isActive: true,
           reactions: [],
           order: []
         }];
        
        return {
          reactionLists: defaultLists,
          plates: [{
            id: '1',
            name: 'Plate 1',
            isActive: true
          }],
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1,
          defunctWells: new Map(),
          ccWells: new Map(), // Reset ccWells
          previewWells: new Set(),
          isMultiDrag: false
        };
      }),
      
      getReactionById: (id) => get().reactionLists.flatMap(list => list.reactions).find(r => r.id === id),
      
      getReactionAtPosition: (position, plateId?: string) => {
        const state = get();
        if (plateId) {
          return state.reactionLists.flatMap(list => list.reactions).find(r => r.state === position && r.plateId === plateId);
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
        
        return state.reactionLists.flatMap(list => list.reactions).find(r => r.state === position && r.plateId === targetPlateId);
      },
      
      getUsedItems: (plateId?: string) => {
        const state = get();
        if (plateId) {
          return new Set(state.reactionLists.flatMap(list => list.reactions).filter(r => r.state !== 'unused' && r.plateId === plateId).map(r => r.id));
        }
        return new Set(state.reactionLists.flatMap(list => list.reactions).filter(r => r.state !== 'unused' && r.plateId !== undefined).map(r => r.id));
      },

      getReactionsForPlate: (plateId) => get().reactionLists.flatMap(list => list.reactions).filter(r => r.plateId === plateId),

      // Get all reactions from all lists
      getAllReactions: () => get().reactionLists.flatMap(list => list.reactions),
      
         // Get reactions from a specific list
   getReactionsFromList: (listId: string) => {
     const state = get();
     const list = state.reactionLists.find(l => l.id === listId);
     return list ? list.reactions : [];
   },
   
   // Get a specific reaction list by ID
   getReactionListById: (listId: string) => {
     const state = get();
     return state.reactionLists.find(l => l.id === listId);
   }
    }),
    {
      name: 'reactions-storage',
      partialize: (state) => ({
        reactionLists: state.reactionLists.map(list => ({
          ...list,
          reactions: Array.from(list.reactions),
          order: Array.from(list.order)
        })),
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

          // Convert reactionLists back to their original structure
          if (state.reactionLists && Array.isArray(state.reactionLists)) {
            state.reactionLists = state.reactionLists.map(list => ({
              ...list,
              reactions: Array.from(list.reactions),
              order: Array.from(list.order)
            }));
          }
        }
      }
    }
  )
);

