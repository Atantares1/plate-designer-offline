import { Card, CardContent } from "@/components/ui/card";
import { Well } from "../app/type";
import { CircleOff, Group } from "lucide-react";

interface WellCardProps {
  well: Well;
  isDefunct?: boolean;
  isCC?: boolean;
}

// Function to calculate dynamic font size based on estimated text rows
const getDynamicFontSize = (text: string): string => {
  const length = text.length;
  // Estimate rows: roughly 8-10 characters per row in a well
  const estimatedRows = Math.ceil(length / 9);
  
  if (estimatedRows <= 3) return 'text-[13px]';
  if (estimatedRows === 4) return 'text-[12px]';
  return 'text-[11px]'; 
};

export function WellCard({ well, isDefunct, isCC }: WellCardProps) {
  const hasReaction = !!well.reaction;
  
  return (
    <div className="h-full  w-full flex flex-col justify-between select-none">
      <div className={`text-[10px] text-center select-none ${hasReaction ? 'text-blue-600' : isDefunct ? 'text-red-600' : isCC ? 'text-yellow-600' : 'text-gray-400'}`}>
        {well.col}{well.row}
      </div>
      <div className="text-sm font-medium text-center flex-1 flex items-center justify-center select-none w-full">
        {well.reaction ? (
          <div className="text-center select-none w-full">
            <div className={`font-medium text-blue-900 truncate select-none whitespace-normal break-words w-full ${getDynamicFontSize(well.reaction.name)}`}>
              {well.reaction.name}
            </div>
            <div className="text-[12px] text-red-700 truncate select-none whitespace-normal break-words w-full">
              {well.reaction.primer}
            </div>
          </div>
        ) : isDefunct ? (
          <div className="text-red-600 pt-4 text-xs font-medium select-none"><CircleOff className="size-4"/></div>
        ) : isCC ? (
          <div className="text-yellow-600 pt-4 text-xs font-medium select-none"><Group className="size-5"/></div>
        ) : (
          <div className="text-gray-400 text-xs select-none">Empty</div>
        )}
      </div>
    </div>
  );
}
