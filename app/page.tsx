'use client';

import { useState, useRef, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, pointerWithin, DragOverEvent } from '@dnd-kit/core';
import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppSidebar } from '@/components/app-sidebar';
import { PlateMenu } from '@/components/plate-menu';
import { ReactionListMenu } from '@/components/reaction-list-menu';
import { Reaction, Well } from './type';
import { useReactionsStore } from '@/store/data';
import ClipboardParser from '@/components/clickboardParser';
import { Toaster, toast } from 'sonner';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Printer, RefreshCcw } from 'lucide-react';

const WellGrid = dynamic(() => import('../components/well-grid').then(mod => ({ default: mod.WellGrid })), { ssr: false });



export default function Home() {
  // Use Zustand store instead of local state
     const {
     reactionLists,
     plates,
     selectedItems,
     selectedOrder,
     lastSelectedIndex,
     previewWells,
     setSelectedItems,
     setSelectedOrder,
     setLastSelectedIndex,
     setPreviewWells,
     clearSelection,
     getReactionById,
     getReactionAtPosition,
     getUsedItems,
     moveReaction,
     swapReactions,
     toggleDefunctWell,
     toggleCCWell,
     getActivePlate,
     getReactionsForPlate,
     getDefunctWellsForPlate,
     getCCWellsForPlate,
     getAllReactions
   } = useReactionsStore();

  const [activeExperiment, setActiveExperiment] = useState<Reaction | null>(null);
  const [pickedUpReaction, setPickedUpReaction] = useState<{ reaction: Reaction; from: string } | null>(null);
  const [isClient, setIsClient] = useState(false);


  useEffect(() => {
    setIsClient(true);
  }, []);

  // Ensure there's always at least one plate available
  useEffect(() => {
    if (isClient && plates.length === 0) {
      // This should not happen with the store changes, but as a safety measure
      const { addPlate } = useReactionsStore.getState();
      addPlate();
    }
  }, [isClient, plates.length]);

  // Helper function to calculate preview wells for both single and multiple reactions
  const calculatePreviewWells = (targetPosition: string, selectedItems: string[]) => {
    const previewPositions = new Set<string>();
    const availableItems = selectedItems.filter((id: string) => {
      const r = getReactionById(id);
      return r && r.state === 'unused';
    });

    if (availableItems.length === 0) return previewPositions;

    const activePlate = getActivePlate();
    const defunctWells = activePlate ? getDefunctWellsForPlate(activePlate.id) : new Set();
    const ccWells = activePlate ? getCCWellsForPlate(activePlate.id) : new Set();

    // Parse starting position
    const col = targetPosition.charAt(0);
    const row = parseInt(targetPosition.slice(1));
    let currentCol = col.charCodeAt(0) - 65;
    let currentRow = row - 1;

    // For each item, find the first available well starting from the target position
    availableItems.forEach((itemId: string, index: number) => {
      let found = false;
      let searchCol = currentCol;
      let searchRow = currentRow;
      
      // Search for available well
      while (searchCol < 8 && searchRow < 12 && !found) {
        const position = `${String.fromCharCode(65 + searchCol)}${(searchRow + 1).toString().padStart(2, '0')}`;
        
        // Check if this well is available
        if (!defunctWells.has(position) && !ccWells.has(position) && !getReactionAtPosition(position, activePlate?.id)) {
          // Found an available well - add it to preview
          previewPositions.add(position);
          found = true;
          
          // Update current position for next item
          currentCol = searchCol + 1;
          currentRow = searchRow;
          if (currentCol >= 8) {
            currentCol = 0;
            currentRow++;
          }
        } else {
          // Move to next well
          searchCol++;
          if (searchCol >= 8) {
            searchCol = 0;
            searchRow++;
          }
        }
      }
    });

    return previewPositions;
  };

  // Helper function to create well grid from reactions
  const createWellGrid = (): Well[][] => {
    const grid: Well[][] = [];
    const activePlate = getActivePlate();
    
    // Safety check - if no active plate, return empty grid
    if (!activePlate) {
      return grid;
    }
    
    for (let col = 0; col < 8; col++) {
      const colLetter = String.fromCharCode(65 + col);
      const colWells: Well[] = [];
      
      for (let row = 1; row <= 12; row++) {
        const position = `${colLetter}${row.toString().padStart(2, '0')}`;
        const reaction = getReactionAtPosition(position, activePlate.id);
        
        colWells.push({
          col: colLetter,
          row: row,
          reaction: reaction
        });
      }
      
      grid.push(colWells);
    }
    
    return grid;
  };

  // Handler for item selection
  const handleItemClick = (reactionId: string, event: React.MouseEvent, sortedReactions?: any[], currentIndex?: number) => {
    event.preventDefault();
    event.stopPropagation();

    // Check if this reaction belongs to the active list
    const { getActiveReactionList } = useReactionsStore.getState();
    const activeList = getActiveReactionList();
    
    if (!activeList || !activeList.reactions.some(r => r.id === reactionId)) {
      // Reaction doesn't belong to active list, don't allow selection
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+click for multi-selection
      const newSelectedItems = new Set(selectedItems);
      if (newSelectedItems.has(reactionId)) {
        newSelectedItems.delete(reactionId);
      } else {
        newSelectedItems.add(reactionId);
      }
      setSelectedItems(newSelectedItems);
      
      const newSelectedOrder = selectedOrder.includes(reactionId) 
        ? selectedOrder.filter(id => id !== reactionId)
        : [...selectedOrder, reactionId];
      setSelectedOrder(newSelectedOrder);
    } else if (event.shiftKey && lastSelectedIndex !== -1) {
      // Shift+click for range selection - use sorted reactions if available
      const reactionsToUse = sortedReactions || getAllReactions().filter(r => r.state === 'unused');
      const currentReactionIndex = currentIndex !== undefined ? currentIndex : reactionsToUse.findIndex(r => r.id === reactionId);
      const lastSelectedReaction = getAllReactions()[lastSelectedIndex];
      const lastSelectedReactionIndex = reactionsToUse.findIndex(r => r.id === lastSelectedReaction?.id);
      
      if (currentReactionIndex !== -1 && lastSelectedReactionIndex !== -1) {
        const startIndex = Math.min(lastSelectedReactionIndex, currentReactionIndex);
        const endIndex = Math.max(lastSelectedReactionIndex, currentReactionIndex);
        
        const rangeIds = reactionsToUse.slice(startIndex, endIndex + 1).map(r => r.id);
        setSelectedItems(new Set(rangeIds));
        setSelectedOrder(rangeIds);
      }
    } else {
      // Single click
      setSelectedItems(new Set([reactionId]));
      setSelectedOrder([reactionId]);
    }
    
    setLastSelectedIndex(getAllReactions().findIndex(r => r.id === reactionId));
  };



     // Handler for drag start
   const handleDragStart = (event: DragStartEvent) => {
     const { active } = event;
     const reaction = getReactionById(active.id as string);
     
     if (reaction) {
       // Check if this reaction belongs to the active list
       const { getActiveReactionList } = useReactionsStore.getState();
       const activeList = getActiveReactionList();
       
       if (!activeList || !activeList.reactions.some(r => r.id === reaction.id)) {
         // Reaction doesn't belong to active list, don't allow drag
         return;
       }
       
       setActiveExperiment(reaction);
     }
   };

     // Handler for drag over
   const handleDragOver = (event: DragOverEvent) => {
     const { active, over } = event;
     
     if (over && active) {
       const activeData = active.data.current;
       
       // For single reactions, we need to check if they're actually available for placement
       let itemsToPreview: string[] = [];
       
       if (activeData?.selectedItems && activeData.selectedItems.length > 0) {
         // Multiple selected items
         itemsToPreview = activeData.selectedItems;
       } else {
         // Single reaction - check if it's available for placement
         const reaction = getReactionById(active.id as string);
         if (reaction && reaction.state === 'unused') {
           itemsToPreview = [active.id as string];
         }
       }
       
       if (itemsToPreview.length > 0) {
         const previewPositions = calculatePreviewWells(over.id as string, itemsToPreview);
         setPreviewWells(previewPositions);
       } else {
         setPreviewWells(new Set());
       }
     } else {
       setPreviewWells(new Set());
     }
   };

  // Handler for drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active) {
      const targetPosition = over.id as string;
      const reaction = getReactionById(active.id as string);
      
      if (reaction) {
        // Check if this reaction belongs to the active list
        const { getActiveReactionList } = useReactionsStore.getState();
        const activeList = getActiveReactionList();
        
        if (!activeList || !activeList.reactions.some(r => r.id === reaction.id)) {
          return;
        }
        
         const activeData = active.data.current;
         let itemsToPlace: string[] = [];
         
         if (activeData?.selectedItems && activeData.selectedItems.length > 0) {
           // Multiple selected items - check if they all belong to active list
           if (!activeData.selectedItems.every((id: string) => 
             activeList.reactions.some(r => r.id === id)
           )) {
             return; // Some items don't belong to active list
           }
           itemsToPlace = activeData.selectedItems;
         } else {
           // Single reaction - check if it belongs to active list and is available
           if (!activeList.reactions.some(r => r.id === reaction.id)) {
             return; // Reaction doesn't belong to active list
           }
           if (reaction.state !== 'unused') {
             return; // Reaction is not available for placement
           }
           itemsToPlace = [reaction.id];
         }
         
         // Filter to only available items
         const availableItems = itemsToPlace.filter((id: string) => {
           const r = getReactionById(id);
           return r && r.state === 'unused';
         });
         
         if (availableItems.length > 0) {
           const activePlate = getActivePlate();
           const activeDefunctWells = activePlate ? getDefunctWellsForPlate(activePlate.id) : new Set();
           const activeCCWells = activePlate ? getCCWellsForPlate(activePlate.id) : new Set();
           
           // Parse starting position
           const col = targetPosition.charAt(0);
           const row = parseInt(targetPosition.slice(1));
           let currentCol = col.charCodeAt(0) - 65;
           let currentRow = row - 1;
           
           const placedItems: string[] = [];
           
           availableItems.forEach((itemId: string) => {
             // Skip defunct wells, CC wells, and occupied wells
             while (currentCol < 8 && currentRow < 12) {
               const position = `${String.fromCharCode(65 + currentCol)}${(currentRow + 1).toString().padStart(2, '0')}`;
               if (!activeDefunctWells.has(position) && !activeCCWells.has(position) && !getReactionAtPosition(position, activePlate?.id)) {
                 break;
               }
               currentCol++;
               if (currentCol >= 8) {
                 currentCol = 0;
                 currentRow++;
               }
             }
             
             if (currentCol < 8 && currentRow < 12) {
               const position = `${String.fromCharCode(65 + currentCol)}${(currentRow + 1).toString().padStart(2, '0')}`;
               moveReaction(itemId, position);
               placedItems.push(itemId);
               
               // Move to next position horizontally
               currentCol++;
               if (currentCol >= 8) {
                 currentCol = 0;
                 currentRow++;
               }
             }
           });
           
           // Clear selection after successful placement
           if (placedItems.length > 0) {
             setSelectedItems(new Set());
             setSelectedOrder([]);
           }
         }
      }
    }
    
         setActiveExperiment(null);
     setPreviewWells(new Set());
  };

  // Handler for well right click (cycle through: normal → defunct → CC → normal)
  const handleWellRightClick = (col: string, row: number, event: React.MouseEvent) => {
    event.preventDefault();
    const position = `${col}${row.toString().padStart(2, '0')}`;
    const activePlate = getActivePlate();
    if (!activePlate) return;

    // First, remove any existing reaction from this well
    const existingReaction = getReactionAtPosition(position, activePlate.id);
    if (existingReaction) {
      // Check if this reaction belongs to the active list
      const { getActiveReactionList } = useReactionsStore.getState();
      const activeList = getActiveReactionList();
      
      if (activeList && activeList.reactions.some(r => r.id === existingReaction.id)) {
        // Only remove reactions that belong to the active list
        moveReaction(existingReaction.id, 'unused');
      }
    }

    const defunctWells = getDefunctWellsForPlate(activePlate.id);
    const ccWells = getCCWellsForPlate(activePlate.id);
    
    const isDefunct = defunctWells.has(position);
    const isCC = ccWells.has(position);
    
    if (!isDefunct && !isCC) {
      // Normal → Defunct
      toggleDefunctWell(activePlate.id, position);
    } else if (isDefunct && !isCC) {
      // Defunct → CC (remove from defunct, add to CC)
      toggleDefunctWell(activePlate.id, position);
      toggleCCWell(activePlate.id, position);
    } else if (!isDefunct && isCC) {
      // CC → Normal (remove from CC)
      toggleCCWell(activePlate.id, position);
    }
  };

  // Handler for clicking a well to pick up a reaction
  const handleWellClick = (col: string, row: number, well: Well) => {
    const position = `${col}${row.toString().padStart(2, '0')}`;
    const reaction = getReactionAtPosition(position, activePlate?.id);
    
    if (reaction) {
      // Check if this reaction belongs to the active list
      const { getActiveReactionList } = useReactionsStore.getState();
      const activeList = getActiveReactionList();
      
      if (!activeList || !activeList.reactions.some(r => r.id === reaction.id)) {
        // Reaction doesn't belong to active list, don't allow pickup
        return;
      }
      
      setPickedUpReaction({ reaction, from: position });
      setActiveExperiment(reaction);
      // Remove the reaction from the well immediately
      moveReaction(reaction.id, 'unused');
    }
  };

  const wells = createWellGrid();
  const usedItems = getUsedItems(); 
  const activePlate = getActivePlate();
  
  if (!activePlate) {
    return (
      <div className="flex h-screen bg-gray-50 w-[100vw] items-center justify-center">
        <div className="text-center text-gray-500">Loading plate data...</div>
      </div>
    );
  }
  
  const activeDefunctWells: Set<string> = getDefunctWellsForPlate(activePlate.id);
  const activeCCWells: Set<string> = getCCWellsForPlate(activePlate.id);







  // Function to generate TSV data in the format shown in the image
  const generateTSV = () => {
    if (!activePlate) return '';

    const plateReactions = getReactionsForPlate(activePlate.id);
    const defunctWells = getDefunctWellsForPlate(activePlate.id);
    const ccWells = getCCWellsForPlate(activePlate.id);

    const header1 = ['Container Name', 'Plate ID', 'Description', 'ContainerType', 'AppType', 'Owner', 'Operator', 'PlateSealin', 'SchedulingPref'];
    const header2 = [activePlate.name, activePlate.name, '', '96-Well', 'Regular', 'W', 'W', 'Septa', '1234'];
    const header3 = ['AppServer','AppInstance'];
    const header4 = ['SequencingAnalysis'];
    const header5 = ['Well', 'Sample Name', 'Comment', 'Results Group 1', 'Instrument Protocol 1','Analysis Protocol 1'];
    
    // Generate well data rows - ALL wells (96 wells total)
    const wellRows = [];
    for (let row = 1; row <= 12; row++) {
      for (let col = 0; col < 8; col++) {
        const colLetter = String.fromCharCode(65 + col);
        const position = `${colLetter}${row.toString().padStart(2, '0')}`;
        
        // Find reaction that is placed in this well position on the current plate
        const reaction = plateReactions.find(r => r.state === position);
        const isDefunct = defunctWells.has(position);
        const isCC = ccWells.has(position);
        
        // Determine sample name based on well state
        let sampleName = '-'; // Default for empty wells
        if (reaction) {
          sampleName = reaction.name+"-"+reaction.primer;
        } else if (isDefunct) {
          sampleName = 'Defunct';
        } else if (isCC) {
          sampleName = 'CC';
        }
        
        wellRows.push([
          position,
          sampleName,
          '', // Comment
          'ATANTARES', // Results Group 1
          'LONG',
          'ATANTARES'  // Instrument Analysis Protocol 1
        ]);
      }
    }
    
    // Combine all rows
    const allRows = [
      header1,
      header2,
      header3,
      header4,
      header5,
      ...wellRows
    ];
    
    // Convert to TSV
    return allRows.map(row => row.join('\t')).join('\n');
  };

  // Function to download TSV file
  const downloadTSV = () => {
    const tsvData = generateTSV();
    if (!tsvData) {
      toast.error('No plate data to export');
      return;
    }

    const blob = new Blob([tsvData], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePlate?.name || 'plate'}.tsv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`成功输出TSV文件: ${activePlate?.name || 'plate'}.tsv`);
  };

  // Reset current plate function
  const resetCurrentPlate = () => {
    const activePlate = getActivePlate();
    if (!activePlate) {
      toast.error('No active plate to reset');
      return;
    }

    // Move all reactions from this plate back to unused state
    const plateReactions = getReactionsForPlate(activePlate.id);
    plateReactions.forEach(reaction => {
      moveReaction(reaction.id, 'unused');
    });

    // Clear defunct and CC wells for this plate
    const defunctWells = getDefunctWellsForPlate(activePlate.id);
    const ccWells = getCCWellsForPlate(activePlate.id);
    
    defunctWells.forEach(well => {
      toggleDefunctWell(activePlate.id, well);
    });
    
    ccWells.forEach(well => {
      toggleCCWell(activePlate.id, well);
    });

  };

  // Print plate layout function
  const printPlateLayout = (includePosition = false) => {
    const activePlate = getActivePlate();
    if (!activePlate) {
      toast.error('No active plate to print');
      return;
    }
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    // Generate print HTML
    const printHTML = generatePrintHTML(includePosition);
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  // Generate HTML for printing
  const generatePrintHTML = (includePosition = false) => {
    const activePlate = getActivePlate();
    if (!activePlate) return '';

    const wells = createWellGrid();
    const defunctWells = getDefunctWellsForPlate(activePlate.id);
    const ccWells = getCCWellsForPlate(activePlate.id);

    let wellsHTML = '';
    
    // Add column headers (1-12)
    wellsHTML += '<div class="well-print header"></div>'; // Empty corner
    for (let i = 1; i <= 12; i++) {
      wellsHTML += `<div class="well-print header">${i}</div>`;
    }
    
    // Generate wells HTML with row headers
    wells.forEach((col, colIndex) => {
      // Add row header (A-H)
      const rowLetter = String.fromCharCode(65 + colIndex);
      wellsHTML += `<div class="well-print header">${rowLetter}</div>`;
      
      col.forEach((well, rowIndex) => {
        const position = `${well.col}${well.row.toString().padStart(2, '0')}`;
        const isDefunct = defunctWells.has(position);
        const isCC = ccWells.has(position);
        const hasReaction = !!well.reaction;
        
        let wellClass = 'well-print empty';
        let wellContent = '-';
        let wellPrimer = '';
        
        if (isDefunct) {
          wellClass = 'well-print defunct';
          wellContent = 'Defunct';
        } else if (isCC) {
          wellClass = 'well-print cc';
          wellContent = 'CC';
        } else if (hasReaction) {
          wellClass = 'well-print reaction';
          wellContent = well.reaction?.name || 'Reaction';
          wellPrimer = well.reaction?.primer || '';
        }
        
        // Build well HTML based on includePosition flag
        if (includePosition) {
          // Well mode - show sample position with original source plate prefix in middle area
          let wellModeContent = '-';
          if (hasReaction) {
            if (well.reaction?.position) {
              // 3-column format: show source plate + position
              const sourceList = reactionLists.find(list => 
                list.reactions.some(r => r.id === well.reaction?.id)
              );
              const sourcePlateName = sourceList ? sourceList.name : 'unknown';
              wellModeContent = `${sourcePlateName}-${well.reaction.position}`;
            } else {
              // 2-column format: just show sample name (no position info)
              wellModeContent = well.reaction?.name || 'Reaction';
            }
          }
          
          wellsHTML += `
            <div class="${wellClass}">
              <div class="well-position">${position}</div>
              <div class="well-content">${wellModeContent}</div>
              <div class="well-primer" style="-webkit-print-color-adjust: exact; color-adjust: exact; print-color-adjust: exact;">${wellPrimer || ' '}</div>
            </div>
          `;
        } else {
          // Sample mode - original layout (sample name in middle)
          wellsHTML += `
            <div class="${wellClass}">
              <div class="well-position">${position}</div>
              <div class="well-content">${wellContent}</div>
              <div class="well-primer" style="-webkit-print-color-adjust: exact; color-adjust: exact; print-color-adjust: exact;">${wellPrimer || ' '}</div>
            </div>
          `;
        }
      });
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>板号 - ${activePlate.name}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              margin: 0; 
              padding: 10px; 
              font-family: Arial, sans-serif;
              background: white;
            }
            .print-container { 
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }
            .print-header { 
              text-align: left; 
              font-size: 14px; 
              font-weight: bold; 
              margin-bottom: 10px; 
              color: black; 
            }
            .well-grid { 
              display: grid; 
              grid-template-columns: 30px repeat(12, 1fr); 
              grid-template-rows: 30px repeat(8, 1fr);
              gap: 1px; 
              width: 100%;
              max-width: 100%;
              height: calc(100vh - 50px);
              margin: 0 auto;
            }
            .well-print { 
              border: 1px solid #333; 
              padding: 1px; 
              display: flex; 
              flex-direction: column; 
              justify-content: space-between; 
              align-items: center; 
              text-align: center; 
              break-inside: avoid;
              min-height: 0;
              font-size: 12px;
              line-height: 1.1;
            }
            .well-print.header {
              background-color: #f0f0f0;
              font-weight: bold;
              font-size: 12px;
              color: #333;
              border: none;
              justify-content: center;
            }
            .well-print.empty { 
              color: #6b7280; 
              background-color: rgba(0, 0, 0, 0.14);
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
            }
            .well-print.defunct { 
              color: #dc2626; 
              background-color: rgba(0, 0, 0, 0.14);
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
            }
            .well-print.cc { 
              color: #d97706; 
              background-color: rgba(0, 0, 0, 0.14);
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
            }
            .well-print.reaction { 
              color: #1e40af; 
              background-color: rgba(0, 0, 0, 0.14);
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
            }
            .well-position {
              margin-top: 2px;
              font-weight: bold;
              font-size: 8px;
              margin-bottom: 1px;
              flex-shrink: 0;
              width: 100%;
              padding: 2px 4px;
              text-align: center;
            }
            .well-content {
              font-size: 10px;
              word-break: break-all;
              overflow: hidden;
              max-width: 100%;
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .well-sample-position {
              font-size: 10px;
              color: #1e40af;
              word-break: break-all;
              overflow: hidden;
              max-width: 100%;
              flex-shrink: 0;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
              min-height: 16px;
              height: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #dbeafe;
              width: 100%;
              padding: 2px 4px;
              text-align: center;
              font-weight: bold;
            }
            .well-primer {
              font-size: 10px;
              color: #f00;
              margin-top: auto;
              word-break: break-all;
              overflow: hidden;
              max-width: 100%;
              flex-shrink: 0;
              margin-bottom: 2px;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
              min-height: 16px;
              height: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: white;
              width: 100%;
              padding: 2px 4px;
              text-align: center;
            }
            @media print {
              @page { 
                size: A4 landscape; 
                margin: 0.5cm; 
              }
              body { 
                margin: 0; 
                padding: 5px; 
              }
              .well-grid {
                height: calc(100vh - 60px);
              }
              .well-position {
                width: 100% !important;
                padding: 2px 4px !important;
                text-align: center !important;
              }
              .well-content {
                /* No background - inherits from well */
              }
              .well-sample-position {
                background-color: #dbeafe !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
                color: #1e40af !important;
                font-weight: bold !important;
                width: 100% !important;
                text-align: center !important;
                min-height: 16px !important;
                height: 16px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .well-primer {
                background-color: white !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
                font-weight: bold !important;            
                width: 100% !important;
                text-align: center !important;
                min-height: 16px !important;
                height: 16px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="print-header">板号: ${activePlate.name}</div>
            <div class="well-grid">
              ${wellsHTML}
            </div>
          </div>
        </body>
      </html>
    `;
  };



  // Show loading state during SSR
  if (!isClient) {
    return (

            <div className="text-center text-gray-500">Loading...</div>
        
    );
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={(event) => handleDragEnd(event)}
    >
             <PlateMenu/>
       
       <ClipboardParser />

      <Toaster position="top-center" richColors />

      <div className="flex h-screen bg-gray-50 w-[100vw]">
       
        <div className="flex-1 flex">
          
          <div className="flex-1">
                         <WellGrid
               wells={wells}
               defunctWells={activeDefunctWells}
               ccWells={activeCCWells}
               previewWells={previewWells}
               onWellRightClick={handleWellRightClick}
               onWellClick={handleWellClick}
             />
          </div>
          
          <Sidebar side='right'>
            <SidebarHeader>
              <div className='flex gap-2 pl-2'>         
            <Button
              onClick={downloadTSV}
              className="px-2 py-1 text-xs bg-blue-400 text-white rounded hover:bg-orange-300 transition-colors"
            >
              TSV
            </Button>

            <Button variant="outline" className="w-10 px-2 py-1 text-xs  rounded hover:bg-orange-300 transition-colors flex flex-col items-center" onClick={() => printPlateLayout(true)}>
              <div className="flex items-center justify-center mt-1">
                <Printer className="w-4 h-4"/>
              </div>
              <span className="text-[8px] ">+Well</span>
            </Button>
            <Button className="w-10 px-2 py-1 text-xs bg-blue-400 text-white rounded hover:bg-orange-300 transition-colors flex flex-col items-center" onClick={() => printPlateLayout(false)}>
              <div className="flex items-center justify-center mt-1">
                <Printer className="w-4 h-4"/>
              </div>
              <span className="text-[8px]">Sample</span>
            </Button>
            <Button 
              onClick={resetCurrentPlate}
              className="px-2 py-1 text-xs bg-blue-400 text-white rounded hover:bg-orange-300 transition-colors"
            >
              <RefreshCcw/>
            </Button>
            </div>
           
            </SidebarHeader>
            <SidebarContent>
              <ScrollArea className="h-full">
                <AppSidebar
                  selectedItems={selectedItems}
                  selectedOrder={selectedOrder}
                  usedItems={usedItems}
                  lastSelectedIndex={lastSelectedIndex}
                  setLastSelectedIndex={setLastSelectedIndex}
                  onItemClick={handleItemClick}
                  onClearSelection={clearSelection}
                  activePlateName={activePlate?.name}
                />
              </ScrollArea>
            </SidebarContent>
          </Sidebar>
        </div>
      </div>

             <DragOverlay>
         {activeExperiment ? (
           <div className="bg-white border-2 border-blue-300 rounded-md p-2 shadow-lg transform -translate-x-2 -translate-y-2">
             <div className="text-sm font-medium text-blue-900">{activeExperiment.name}</div>
             <div className="text-xs text-blue-700">{activeExperiment.primer}</div>
             {selectedItems.size > 1 && (
               <div className="text-xs text-blue-600 mt-1">
                 +{selectedItems.size - 1} more
               </div>
             )}
           </div>
         ) : null}
       </DragOverlay>
    </DndContext>
  );
}
