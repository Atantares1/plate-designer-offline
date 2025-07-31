"use client"

import * as React from "react"
import { GripVertical, Check, ArrowDownNarrowWide } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"

type SortMethod = 'sample' | 'primer';

interface Reaction {
  id: string
  name: string
  primer: string
  state: string // either "unused" or a well position like "A1", "B3", etc.
}

interface AppSidebarProps {
  reactions: Reaction[];
  selectedItems: Set<string>;
  selectedOrder: string[]; // New prop for selection order
  usedItems: Set<string>;
  lastSelectedIndex: number;
  setLastSelectedIndex: (index: number) => void;
  onItemClick: (reactionId: string, event: React.MouseEvent, reactions: Reaction[], currentIndex: number) => void;
  onClearSelection: () => void;
  activePlateName?: string; // Add active plate name
}

interface DraggableItemProps {
  reaction: Reaction
  isSelected: boolean
  selectedItems: Set<string>
  selectedOrder: string[]
  onClick: (event: React.MouseEvent) => void
}

function DraggableItem({ reaction, isSelected, selectedItems, selectedOrder, onClick }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: reaction.id,
    data: {
      ...reaction,
      selectedItems: Array.from(selectedItems),
      isMultiDrag: selectedItems.size > 1 && selectedItems.has(reaction.id)
    },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} className="list-none">
      <div
        className={cn(
          "flex items-center pr-4 text-xs rounded-md cursor-pointer select-none group relative",
          isSelected && "bg-blue-100 text-blue-900",
          isDragging && "opacity-50",
          !isSelected && "hover:bg-gray-50"
        )}
        onClick={onClick}
      >
        <div
          className="cursor-grab active:cursor-grabbing invisible group-hover:visible"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4 w-8" />
        </div>
        
        <div className="flex flex-col items-start flex-1 min-w-0">
          <span 
            className="font-medium truncate w-full" 
            title={reaction.name}
          >
            {reaction.name.length > 21 ? reaction.name.substring(0, 21) + '..' : reaction.name}
          </span>
          <span 
            className="text-xs text-muted-foreground truncate w-full"
            title={reaction.primer}
          >
            {reaction.primer.length > 21 ? reaction.primer.substring(0, 21) + '..' : reaction.primer}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {isSelected && selectedOrder.length > 1 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {selectedOrder.indexOf(reaction.id) + 1}
            </span>
          )}
          {isSelected && <Check className="size-4 text-green-600 flex-shrink-0" />}
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({ 
  reactions, 
  selectedItems, 
  selectedOrder, 
  usedItems, 
  lastSelectedIndex, 
  setLastSelectedIndex, 
  onItemClick, 
  onClearSelection, 
  activePlateName, 
}: AppSidebarProps) {
  const [sortMethod, setSortMethod] = React.useState<SortMethod>('sample');

  // Sort reactions based on current method
  const sortedReactions = React.useMemo(() => {
    if (sortMethod === 'sample') {
      // Default order - return as is (stable sort)
      return [...reactions];
    } else if (sortMethod === 'primer') {
      // Group by primer, maintaining stable order (first appearance of each primer)
      const primerGroups = new Map<string, Reaction[]>();
      const primerOrder: string[] = [];
      
      // Group reactions by primer and track order of first appearance
      reactions.forEach(reaction => {
        const primer = reaction.primer;
        if (!primerGroups.has(primer)) {
          primerGroups.set(primer, []);
          primerOrder.push(primer); // Track order of first appearance
        }
        primerGroups.get(primer)!.push(reaction);
      });
      
      // Flatten maintaining primer order and reaction order within groups
      const sortedReactions: Reaction[] = [];
      
      primerOrder.forEach(primer => {
        const groupReactions = primerGroups.get(primer)!;
        sortedReactions.push(...groupReactions);
      });
      
      return sortedReactions;
    }
    
    return reactions;
  }, [reactions, sortMethod]);

  // Filter to only show unused reactions
  const unusedReactions = sortedReactions.filter(r => !usedItems.has(r.id));

  return (
    <div className="h-full">
      <div className="text-xs text-muted-foreground  p-4 border-b">
        <div className="text-xl text-blue-900 mb-1">
          {activePlateName || 'Global Reactions'}
        </div>
        <div className="flex items-center justify-between">
          <div>可用: {unusedReactions.length}/{reactions.length} 条反应🧪</div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={() => setSortMethod('sample')}
            className={cn(
              "px-2 h-[24px] text-[12px] rounded transition-colors",
              sortMethod === 'sample' 
                ? "bg-rose-400 text-white" 
                : "bg-blue-400 text-white hover:bg-orange-300"
            )}
          >
            样品排序<ArrowDownNarrowWide/>
          </Button>
          <Button 
            onClick={() => setSortMethod('primer')}
            className={cn(
              "px-2 h-[24px] text-[12px] rounded transition-colors",
              sortMethod === 'primer' 
                ? "bg-rose-400 text-white" 
                : "bg-blue-400 text-white hover:bg-orange-300"
            )}
          >
            引物排序<ArrowDownNarrowWide/>
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1">
          {unusedReactions.map((reaction, index) => {
            const isSelected = selectedItems.has(reaction.id)
            return (
              <DraggableItem
                key={reaction.id}
                reaction={reaction}
                isSelected={isSelected}
                selectedItems={selectedItems}
                selectedOrder={selectedOrder}
                onClick={(event) => onItemClick(reaction.id, event, unusedReactions, index)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
