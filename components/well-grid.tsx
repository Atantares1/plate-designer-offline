'use client';

import { useDroppable } from '@dnd-kit/core';
import { useSidebar } from '@/components/ui/sidebar';
import { Well } from '../app/type';
import { WellCard } from './well-card';

interface WellGridProps {
  wells: Well[][];
  defunctWells?: Set<string>;
  ccWells?: Set<string>;
  previewWells?: Set<string>;
  onWellRightClick?: (col: string, row: number, event: React.MouseEvent) => void;
  onWellClick?: (col: string, row: number, well: Well) => void;
}

export function WellGrid({ wells, defunctWells, ccWells, previewWells, onWellRightClick, onWellClick }: WellGridProps) {
  const { open } = useSidebar();
  
  const wellSize = open ? 'w-28 h-24' : 'w-32 h-24';
  const headerWidth = open ? 'w-28' : 'w-30';
  
  return (
    <div className="bg-white rounded-lg shadow-lg h-full  flex flex-col select-none">
      
      <div className="flex-1 overflow-auto flex justify-center">
        <div className={`grid grid-cols-13 gap-1` } style={{ gridTemplateColumns: "30px repeat(12, 1fr)" }}>
          {/* Column headers (1-12) */}
          <div className="w-8 h-10 flex items-center justify-center"></div>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i + 1} className={`${headerWidth} flex items-center justify-center text-xs font-medium text-gray-600 select-none`}>
              {i + 1}
            </div>
          ))}
          
          {/* Row headers and wells */}
          {wells.map((col, colIndex) => (
            <div key={colIndex} className={`contents`}>
              <div className="w-10 h-24 flex items-center justify-center text-xs font-medium text-gray-600 select-none">
                {String.fromCharCode(65 + colIndex)}
              </div>
              
              {col.map((well) => (
                                 <DroppableWell
                   key={`${well.col}${well.row}`}
                   well={well}
                   isDefunct={defunctWells?.has(`${well.col}${well.row.toString().padStart(2, '0')}`)}
                   isCC={ccWells?.has(`${well.col}${well.row.toString().padStart(2, '0')}`)}
                   isPreview={previewWells?.has(`${well.col}${well.row.toString().padStart(2, '0')}`)}
                   
                   onRightClick={onWellRightClick}
                   onClick={onWellClick}
                   wellSize={wellSize}
                 />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DroppableWellProps {
  well: Well;
  isDefunct?: boolean;
  isCC?: boolean;
  isPreview?: boolean;
  onRightClick?: (col: string, row: number, event: React.MouseEvent) => void;
  onClick?: (col: string, row: number, well: Well) => void;
  wellSize: string;
}

function DroppableWell({ well, isDefunct, isCC, isPreview, onRightClick, onClick, wellSize }: DroppableWellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${well.col}${well.row.toString().padStart(2, '0')}`,
  });

  const hasReaction = !!well.reaction;
  const canDrop = !isDefunct && !isCC && !hasReaction;

  return (
    <div
      ref={setNodeRef}
      className={`
        ${wellSize}  border-2 rounded-md p-1 transition-all duration-200 cursor-pointer select-none relative
        ${isDefunct 
          ? 'bg-red-200 border-red-400 opacity-60' 
          : isCC
            ? 'bg-yellow-200 border-yellow-400 opacity-60'
            : isPreview
              ? 'bg-yellow-100 border-yellow-400 border-dashed shadow-md transform scale-105'
              : hasReaction
                ? 'bg-blue-100/50 border-blue-300 hover:bg-blue-100/70'
                : canDrop && isOver 
                  ? 'bg-green-100 border-green-400 border-dashed shadow-md transform scale-105' 
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-gray-400'
        }
      `}
      onContextMenu={onRightClick ? (e) => onRightClick(well.col, well.row, e) : undefined}
      onClick={onClick ? (e) => {
        e.preventDefault();
        onClick(well.col, well.row, well);
      } : undefined}
    >
      <WellCard well={well} isDefunct={isDefunct} isCC={isCC} />
      {isDefunct && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-red-700 font-bold text-base select-none">Defunct</span>
        </div>
      )}
      {isCC && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-yellow-700 font-bold text-lg select-none">CC</span>
        </div>
      )}
      {canDrop && isOver && !isPreview && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      )}
             {isPreview && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
         </div>
       )}
    </div>
  );
} 