import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Reaction } from '@/app/type';

export type ReactionDraft = Omit<Reaction, 'id'>;

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
  nextReactionId: number;
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
  setReactions: (reactions: ReactionDraft[], listId?: string) => void;
  addReactionsToList: (reactions: ReactionDraft[], listId?: string) => void;
  updateReaction: (id: string, updates: Partial<Pick<Reaction, 'name' | 'primer' | 'position'>>) => void;
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
  cycleWellState: (plateId: string, position: string) => void;
  getCCWellsForPlate: (plateId: string) => Set<string>;
  
  setPreviewWells: (wells: Set<string>) => void;
  setIsMultiDrag: (isMulti: boolean) => void;
  
  resetToDefault: () => void;
  resetPlate: (plateId: string) => void;
  repairState: () => void;
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

const WELL_POSITION_PATTERN = /^[A-H](0[1-9]|1[0-2])$/;

const allocateReactionIds = (
  state: Pick<ReactionsState, 'reactionLists' | 'nextReactionId'>,
  reactions: ReactionDraft[],
  excludedListId?: string
) => {
  const usedIds = new Set(
    state.reactionLists
      .filter(list => list.id !== excludedListId)
      .flatMap(list => list.reactions)
      .map(reaction => reaction.id)
  );
  let nextReactionId = Math.max(1, Number.isSafeInteger(state.nextReactionId) ? state.nextReactionId : 1);

  const allocatedReactions = reactions.map(reaction => {
    while (usedIds.has(nextReactionId.toString())) {
      nextReactionId++;
    }
    const id = nextReactionId.toString();
    nextReactionId++;
    usedIds.add(id);
    return { ...reaction, id, state: 'unused', plateId: undefined };
  });

  return { allocatedReactions, nextReactionId };
};

const normalizeHydratedState = (state: ReactionsState) => {
  const plates = Array.isArray(state.plates) && state.plates.length > 0
    ? state.plates.map(plate => ({ ...plate }))
    : [{ id: '1', name: 'Plate 1', isActive: true }];
  const activePlateIndex = Math.max(0, plates.findIndex(plate => plate.isActive));
  plates.forEach((plate, index) => {
    plate.isActive = index === activePlateIndex;
  });
  const validPlateIds = new Set(plates.map(plate => plate.id));

  const toWellMap = (value: unknown) => {
    const result = new Map<string, Set<string>>();
    const entries = value instanceof Map ? Array.from(value.entries()) : Array.isArray(value) ? value : [];
    entries.forEach(entry => {
      if (!Array.isArray(entry) || entry.length !== 2 || !validPlateIds.has(String(entry[0]))) return;
      const wells = entry[1] instanceof Set ? Array.from(entry[1]) : Array.isArray(entry[1]) ? entry[1] : [];
      result.set(String(entry[0]), new Set(wells.filter((well): well is string =>
        typeof well === 'string' && WELL_POSITION_PATTERN.test(well)
      )));
    });
    return result;
  };

  const defunctWells = toWellMap(state.defunctWells);
  const ccWells = toWellMap(state.ccWells);
  ccWells.forEach((wells, plateId) => {
    const defunct = defunctWells.get(plateId);
    if (defunct) wells.forEach(well => defunct.delete(well));
  });

  const sourceLists = Array.isArray(state.reactionLists) && state.reactionLists.length > 0
    ? state.reactionLists
    : [{ id: '1', name: '1', isActive: true, reactions: [], order: [] }];
  const activeListIndex = Math.max(0, sourceLists.findIndex(list => list.isActive));
  const usedIds = new Set<string>();
  let nextReactionId = Math.max(1, Number.isSafeInteger(state.nextReactionId) ? state.nextReactionId : 1);

  sourceLists.forEach(list => {
    (Array.isArray(list.reactions) ? list.reactions : []).forEach(reaction => {
      const numericId = Number.parseInt(reaction.id, 10);
      if (/^\d+$/.test(reaction.id) && Number.isSafeInteger(numericId)) {
        nextReactionId = Math.max(nextReactionId, numericId + 1);
      }
    });
  });

  const occupiedWells = new Set<string>();
  const reactionLists = sourceLists.map((list, listIndex) => {
    const idBuckets = new Map<string, string[]>();
    const reactions = (Array.isArray(list.reactions) ? list.reactions : []).map(reaction => {
      const originalId = typeof reaction.id === 'string' ? reaction.id : '';
      let id = originalId;
      if (!id || usedIds.has(id)) {
        while (usedIds.has(nextReactionId.toString())) nextReactionId++;
        id = nextReactionId.toString();
        nextReactionId++;
      }
      usedIds.add(id);
      idBuckets.set(originalId, [...(idBuckets.get(originalId) || []), id]);

      let normalizedReaction = { ...reaction, id };
      const isPlaced = normalizedReaction.state !== 'unused';
      const wellKey = `${normalizedReaction.plateId}:${normalizedReaction.state}`;
      if (
        isPlaced && (
          !normalizedReaction.plateId ||
          !validPlateIds.has(normalizedReaction.plateId) ||
          !WELL_POSITION_PATTERN.test(normalizedReaction.state) ||
          occupiedWells.has(wellKey)
        )
      ) {
        normalizedReaction = { ...normalizedReaction, state: 'unused', plateId: undefined };
      } else if (!isPlaced) {
        normalizedReaction = { ...normalizedReaction, plateId: undefined };
      } else {
        occupiedWells.add(wellKey);
        defunctWells.get(normalizedReaction.plateId!)?.delete(normalizedReaction.state);
        ccWells.get(normalizedReaction.plateId!)?.delete(normalizedReaction.state);
      }
      return normalizedReaction;
    });

    const orderedIds: string[] = [];
    (Array.isArray(list.order) ? list.order : []).forEach(originalId => {
      const bucket = idBuckets.get(originalId);
      const mappedId = bucket?.shift();
      if (mappedId && !orderedIds.includes(mappedId)) orderedIds.push(mappedId);
    });
    reactions.forEach(reaction => {
      if (!orderedIds.includes(reaction.id)) orderedIds.push(reaction.id);
    });

    return {
      ...list,
      isActive: listIndex === activeListIndex,
      reactions,
      order: orderedIds
    };
  });

  state.plates = plates;
  state.reactionLists = reactionLists;
  state.nextReactionId = nextReactionId;
  state.selectedItems = new Set();
  state.selectedOrder = [];
  state.lastSelectedIndex = -1;
  state.defunctWells = defunctWells;
  state.ccWells = ccWells;
  state.previewWells = new Set();
  state.isMultiDrag = false;
};

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
      nextReactionId: 1,
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
          isActive: true,
          reactions: [],
          order: []
        };
        
        // Set the new list as active and deactivate others
        const updatedLists = state.reactionLists.map(list => ({ ...list, isActive: false }));
        updatedLists.push(newList);
        
        return {
          reactionLists: updatedLists,
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1
        };
      }),

      removeReactionList: (listId) => set((state) => {
        if (state.reactionLists.length <= 1) return state; // Don't delete if it's the only list
        
        const removedReactionIds = new Set(
          state.reactionLists.find(list => list.id === listId)?.reactions.map(reaction => reaction.id) || []
        );
        const updatedLists = state.reactionLists
          .filter(list => list.id !== listId)
          .map(list => ({ ...list }));
        
        // If we deleted the active list, make the first remaining list active
        const wasActive = state.reactionLists.find(list => list.id === listId)?.isActive;
        if (wasActive && updatedLists.length > 0) {
          updatedLists[0].isActive = true;
        }
        
        const selectedItems = new Set(
          Array.from(state.selectedItems).filter(id => !removedReactionIds.has(id))
        );
        const selectedOrder = state.selectedOrder.filter(id => selectedItems.has(id));

        return {
          reactionLists: updatedLists,
          selectedItems,
          selectedOrder,
          lastSelectedIndex: selectedOrder.length > 0 ? state.lastSelectedIndex : -1
        };
      }),

      setActiveReactionList: (listId) => set((state) => {
        if (!state.reactionLists.some(list => list.id === listId)) return state;
        return {
          reactionLists: state.reactionLists.map(list => ({
            ...list,
            isActive: list.id === listId
          })),
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1
        };
      }),

      getActiveReactionList: () => {
        const state = get();
        const activeList = state.reactionLists.find(list => list.isActive);
        if (activeList) return activeList;
        if (state.reactionLists.length > 0) return state.reactionLists[0];
        return undefined;
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
        reactionLists: state.reactionLists.map(list => {
          if (list.id !== listId) return list;
          const validIds = new Set(list.reactions.map(reaction => reaction.id));
          const normalizedOrder = order.filter((id, index) =>
            validIds.has(id) && order.indexOf(id) === index
          );
          list.reactions.forEach(reaction => {
            if (!normalizedOrder.includes(reaction.id)) normalizedOrder.push(reaction.id);
          });
          return { ...list, order: normalizedOrder };
        })
      })),

      reorderReactionInList: (listId, reactionId, newIndex) => set((state) => {
        const list = state.reactionLists.find(l => l.id === listId);
        if (!list) return state;
        
        const currentOrder = [...list.order];
        const currentIndex = currentOrder.indexOf(reactionId);
        
        if (currentIndex === -1) return state;
        
        // Remove from current position and insert at new position
        currentOrder.splice(currentIndex, 1);
        const boundedIndex = Math.max(0, Math.min(newIndex, currentOrder.length));
        currentOrder.splice(boundedIndex, 0, reactionId);
        
        return {
          reactionLists: state.reactionLists.map(l =>
            l.id === listId ? { ...l, order: currentOrder } : l
          )
        };
      }),

      setReactions: (reactions, listId) => set((state) => {
        const targetListId = listId || state.reactionLists.find(list => list.isActive)?.id || '1';
        const targetList = state.reactionLists.find(list => list.id === targetListId);
        if (!targetList) {
          throw new Error('Target reaction list no longer exists');
        }
        const placedReactionCount = targetList.reactions.filter(reaction => reaction.state !== 'unused').length;
        if (placedReactionCount > 0) {
          throw new Error(
            `Cannot replace this list while ${placedReactionCount} reaction${placedReactionCount === 1 ? ' is' : 's are'} placed on plates. Reset those plates first.`
          );
        }
        const namesInOtherLists = new Set(
          state.reactionLists
            .filter(list => list.id !== targetListId)
            .flatMap(list => list.reactions)
            .map(reaction => reaction.name)
        );
        const duplicateNames = Array.from(new Set(
          reactions.filter(reaction => namesInOtherLists.has(reaction.name)).map(reaction => reaction.name)
        ));
        if (duplicateNames.length > 0) {
          throw new Error(`Duplicate sample names detected:\n${duplicateNames.map(name =>
            `Sample "${name}" already exists in another list`
          ).join('\n')}`);
        }
        const { allocatedReactions, nextReactionId } = allocateReactionIds(
          state,
          reactions,
          targetListId
        );

        return {
          reactionLists: state.reactionLists.map(list =>
            list.id === targetListId 
              ? { 
                  ...list, 
                  reactions: allocatedReactions,
                  order: allocatedReactions.map(reaction => reaction.id)
                }
              : list
          ),
          nextReactionId,
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1
        };
      }),

      addReactionsToList: (reactions, listId) => set((state) => {
        const targetListId = listId || state.reactionLists.find(list => list.isActive)?.id || '1';
        if (!state.reactionLists.some(list => list.id === targetListId)) {
          throw new Error('Target reaction list no longer exists');
        }
        const existingNames = new Set(
          state.reactionLists.flatMap(list => list.reactions).map(reaction => reaction.name)
        );
        const duplicateNames = Array.from(new Set(
          reactions.filter(reaction => existingNames.has(reaction.name)).map(reaction => reaction.name)
        ));
        if (duplicateNames.length > 0) {
          throw new Error(`Duplicate sample names detected:\n${duplicateNames.map(name =>
            `Sample "${name}" already exists`
          ).join('\n')}`);
        }
        const { allocatedReactions, nextReactionId } = allocateReactionIds(state, reactions);

        return {
          reactionLists: state.reactionLists.map(list =>
            list.id === targetListId 
              ? { 
                  ...list, 
                  reactions: [...list.reactions, ...allocatedReactions],
                  order: [...list.order, ...allocatedReactions.map(reaction => reaction.id)]
                }
              : list
          ),
          nextReactionId
        };
      }),
      
      updateReaction: (id, updates) => set((state) => ({
        reactionLists: state.reactionLists.map(list => ({
          ...list,
          reactions: list.reactions.map(reaction =>
            reaction.id === id ? {
              ...reaction,
              ...updates,
              sampleNameParts: updates.name === undefined || updates.name === reaction.name
                ? reaction.sampleNameParts
                : undefined
            } : reaction
          )
        }))
      })),
      
      moveReaction: (id, newState) => set((state) => {
        const reaction = state.reactionLists.flatMap(list => list.reactions).find(item => item.id === id);
        if (!reaction) return state;

        const activePlate = state.plates.find(plate => plate.isActive);
        let plateId: string | undefined;
        
        if (newState === 'unused') {
          plateId = undefined;
        } else {
          if (!WELL_POSITION_PATTERN.test(newState)) return state;
          plateId = activePlate?.id || state.plates[0]?.id;
          if (!plateId) return state;
          const isBlocked = state.defunctWells.get(plateId)?.has(newState) ||
            state.ccWells.get(plateId)?.has(newState);
          const isOccupied = state.reactionLists
            .flatMap(list => list.reactions)
            .some(item => item.id !== id && item.plateId === plateId && item.state === newState);
          if (isBlocked || isOccupied) return state;
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
          reactions: list.reactions.map(reaction => {
            if (reaction.id !== reactionId) return reaction;
            if (!state.plates.some(plate => plate.id === plateId)) return reaction;
            if (reaction.state === 'unused') return { ...reaction, plateId: undefined };
            const destinationUnavailable =
              state.defunctWells.get(plateId)?.has(reaction.state) ||
              state.ccWells.get(plateId)?.has(reaction.state) ||
              state.reactionLists.flatMap(item => item.reactions).some(item =>
                item.id !== reactionId && item.plateId === plateId && item.state === reaction.state
              );
            return destinationUnavailable
              ? { ...reaction, state: 'unused', plateId: undefined }
              : { ...reaction, plateId };
          })
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
          isActive: true
        };
        
        // Set the new plate as active and deactivate others
        const updatedPlates = state.plates.map(plate => ({ ...plate, isActive: false }));
        updatedPlates.push(newPlate);
        
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
        const newCCWells = new Map(state.ccWells);
        newCCWells.delete(plateId);
        
        return { 
          plates: updatedPlates,
          reactionLists: updatedReactionLists,
          defunctWells: newDefunctWells,
          ccWells: newCCWells,
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1
        };
      }),

      setActivePlate: (plateId) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId)) return state;
        return {
          plates: state.plates.map(plate => ({
            ...plate,
            isActive: plate.id === plateId
          }))
        };
      }),

      getActivePlate: () => {
        const state = get();
        const activePlate = state.plates.find(plate => plate.isActive);
        // If no active plate, return the first plate as default
        if (activePlate) return activePlate;
        if (state.plates.length > 0) return state.plates[0];
        return undefined;
      },

      // Selection actions
      setSelectedItems: (items) => set((state) => {
        const activeIds = new Set(
          state.reactionLists.find(list => list.isActive)?.reactions.map(reaction => reaction.id) || []
        );
        const selectedItems = new Set(Array.from(items).filter(id => activeIds.has(id)));
        return {
          selectedItems,
          selectedOrder: state.selectedOrder.filter(id => selectedItems.has(id))
        };
      }),
      
      setSelectedOrder: (order) => set((state) => ({
        selectedOrder: order.filter((id, index) =>
          state.selectedItems.has(id) && order.indexOf(id) === index
        )
      })),
      
      setLastSelectedIndex: (index) => set((state) => {
        const reactionCount = state.reactionLists.find(list => list.isActive)?.reactions.length || 0;
        return { lastSelectedIndex: index >= 0 && index < reactionCount ? index : -1 };
      }),
      
      clearSelection: () => set({ 
        selectedItems: new Set(), 
        selectedOrder: [], 
        lastSelectedIndex: -1 
      }),
      
      addToSelection: (id) => set((state) => {
        const isInActiveList = state.reactionLists
          .find(list => list.isActive)
          ?.reactions.some(reaction => reaction.id === id);
        if (!isInActiveList) return state;
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
        const reactions = state.reactionLists.find(list => list.isActive)?.reactions || [];
        const start = Math.max(0, Math.min(startIndex, endIndex));
        const end = Math.min(reactions.length - 1, Math.max(startIndex, endIndex));
        const rangeIds = end >= start ? reactions.slice(start, end + 1).map(r => r.id) : [];
        
        return {
          selectedItems: new Set(rangeIds),
          selectedOrder: rangeIds,
          lastSelectedIndex: rangeIds.length > 0 ? endIndex : -1
        };
      }),

      // Well management
      setDefunctWells: (plateId, wells) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId)) return state;
        const normalizedWells = new Set(Array.from(wells).filter(well => WELL_POSITION_PATTERN.test(well)));
        const newDefunctWells = new Map(state.defunctWells);
        newDefunctWells.set(plateId, normalizedWells);
        const newCCWells = new Map(state.ccWells);
        const plateCCWells = new Set(newCCWells.get(plateId) || []);
        normalizedWells.forEach(well => plateCCWells.delete(well));
        newCCWells.set(plateId, plateCCWells);
        return {
          defunctWells: newDefunctWells,
          ccWells: newCCWells,
          reactionLists: state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.plateId === plateId && normalizedWells.has(reaction.state)
                ? { ...reaction, state: 'unused', plateId: undefined }
                : reaction
            )
          }))
        };
      }),
      
      toggleDefunctWell: (plateId, position) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId) || !WELL_POSITION_PATTERN.test(position)) {
          return state;
        }
        const newDefunctWells = new Map(state.defunctWells);
        const plateWells = new Set(newDefunctWells.get(plateId) || []);
        const newCCWells = new Map(state.ccWells);
        const plateCCWells = new Set(newCCWells.get(plateId) || []);
        let reactionLists = state.reactionLists;
        if (plateWells.has(position)) {
          plateWells.delete(position);
        } else {
          plateWells.add(position);
          plateCCWells.delete(position);
          reactionLists = state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.plateId === plateId && reaction.state === position
                ? { ...reaction, state: 'unused', plateId: undefined }
                : reaction
            )
          }));
        }
        newDefunctWells.set(plateId, plateWells);
        newCCWells.set(plateId, plateCCWells);
        return { defunctWells: newDefunctWells, ccWells: newCCWells, reactionLists };
      }),

      getDefunctWellsForPlate: (plateId) => {
        const state = get();
        return state.defunctWells.get(plateId) || new Set();
      },

      // CC Well management
      setCCWells: (plateId, wells) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId)) return state;
        const normalizedWells = new Set(Array.from(wells).filter(well => WELL_POSITION_PATTERN.test(well)));
        const newCCWells = new Map(state.ccWells);
        newCCWells.set(plateId, normalizedWells);
        const newDefunctWells = new Map(state.defunctWells);
        const plateDefunctWells = new Set(newDefunctWells.get(plateId) || []);
        normalizedWells.forEach(well => plateDefunctWells.delete(well));
        newDefunctWells.set(plateId, plateDefunctWells);
        return {
          ccWells: newCCWells,
          defunctWells: newDefunctWells,
          reactionLists: state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.plateId === plateId && normalizedWells.has(reaction.state)
                ? { ...reaction, state: 'unused', plateId: undefined }
                : reaction
            )
          }))
        };
      }),

      toggleCCWell: (plateId, position) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId) || !WELL_POSITION_PATTERN.test(position)) {
          return state;
        }
        const newCCWells = new Map(state.ccWells);
        const plateWells = new Set(newCCWells.get(plateId) || []);
        const newDefunctWells = new Map(state.defunctWells);
        const plateDefunctWells = new Set(newDefunctWells.get(plateId) || []);
        let reactionLists = state.reactionLists;
        if (plateWells.has(position)) {
          plateWells.delete(position);
        } else {
          plateWells.add(position);
          plateDefunctWells.delete(position);
          reactionLists = state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.plateId === plateId && reaction.state === position
                ? { ...reaction, state: 'unused', plateId: undefined }
                : reaction
            )
          }));
        }
        newCCWells.set(plateId, plateWells);
        newDefunctWells.set(plateId, plateDefunctWells);
        return { ccWells: newCCWells, defunctWells: newDefunctWells, reactionLists };
      }),

      cycleWellState: (plateId, position) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId) || !WELL_POSITION_PATTERN.test(position)) {
          return state;
        }
        const newDefunctWells = new Map(state.defunctWells);
        const newCCWells = new Map(state.ccWells);
        const plateDefunctWells = new Set(newDefunctWells.get(plateId) || []);
        const plateCCWells = new Set(newCCWells.get(plateId) || []);
        const isDefunct = plateDefunctWells.has(position);
        const isCC = plateCCWells.has(position);
        let reactionLists = state.reactionLists;

        if (!isDefunct && !isCC) {
          plateDefunctWells.add(position);
          reactionLists = state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.plateId === plateId && reaction.state === position
                ? { ...reaction, state: 'unused', plateId: undefined }
                : reaction
            )
          }));
        } else if (isDefunct) {
          plateDefunctWells.delete(position);
          plateCCWells.add(position);
        } else {
          plateCCWells.delete(position);
        }

        newDefunctWells.set(plateId, plateDefunctWells);
        newCCWells.set(plateId, plateCCWells);
        return { defunctWells: newDefunctWells, ccWells: newCCWells, reactionLists };
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
          nextReactionId: 1,
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1,
          defunctWells: new Map(),
          ccWells: new Map(), // Reset ccWells
          previewWells: new Set(),
          isMultiDrag: false
        };
      }),

      resetPlate: (plateId) => set((state) => {
        if (!state.plates.some(plate => plate.id === plateId)) return state;
        const defunctWells = new Map(state.defunctWells);
        const ccWells = new Map(state.ccWells);
        defunctWells.delete(plateId);
        ccWells.delete(plateId);
        return {
          reactionLists: state.reactionLists.map(list => ({
            ...list,
            reactions: list.reactions.map(reaction =>
              reaction.plateId === plateId
                ? { ...reaction, state: 'unused', plateId: undefined }
                : reaction
            )
          })),
          defunctWells,
          ccWells,
          selectedItems: new Set(),
          selectedOrder: [],
          lastSelectedIndex: -1,
          previewWells: new Set()
        };
      }),

      repairState: () => set((state) => {
        normalizeHydratedState(state);
        return {
          plates: state.plates,
          reactionLists: state.reactionLists,
          nextReactionId: state.nextReactionId,
          selectedItems: state.selectedItems,
          selectedOrder: state.selectedOrder,
          lastSelectedIndex: state.lastSelectedIndex,
          defunctWells: state.defunctWells,
          ccWells: state.ccWells,
          previewWells: state.previewWells,
          isMultiDrag: state.isMultiDrag
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
        
        if (!targetPlateId) return undefined;
        
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
        nextReactionId: state.nextReactionId,
        defunctWells: Array.from(state.defunctWells.entries()).map(([key, value]) => [key, Array.from(value)]),
        ccWells: Array.from(state.ccWells.entries()).map(([key, value]) => [key, Array.from(value)])
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
          state.repairState();
        }
      }
    }
  )
);

