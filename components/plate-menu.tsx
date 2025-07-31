"use client"

import { useState } from "react"
import { Plus, ChevronRight } from "lucide-react"
import { useReactionsStore } from "@/store/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function PlateMenu() {
  const { 
    plates, 
    addPlate, 
    renamePlate, 
    deletePlate, 
    setActivePlate
  } = useReactionsStore()
  
  const [editingPlateId, setEditingPlateId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [isVisible, setIsVisible] = useState(false)

  const handleAddPlate = () => {
    addPlate()
    toast.success("新增实验板!")
  }

  const handleDoubleClick = (plateId: string, currentName: string) => {
    setEditingPlateId(plateId)
    setEditName(currentName)
  }

  const handleSaveEdit = () => {
    if (editingPlateId && editName.trim()) {
      renamePlate(editingPlateId, editName.trim())
      setEditingPlateId(null)
      setEditName("")
      toast.success("实验板重命名成功!")
    }
  }

  const handleCancelEdit = () => {
    setEditingPlateId(null)
    setEditName("")
  }

  const handleDeletePlate = (plateId: string, plateName: string) => {
    if (plates.length <= 1) {
      toast.error("无法删除最后一块实验板!")
      return
    }
    
    // Delete the plate (store will handle freeing reactions and cleaning up defunct wells)
    deletePlate(plateId)
    toast.success(`实验板 "${plateName}" 已被删除!`)
  }

  const handlePlateClick = (plateId: string) => {
    setActivePlate(plateId)
  }

  const toggleMenu = () => {
    setIsVisible(!isVisible)
  }

  return (
    <>
      <button
        onClick={toggleMenu}
        className={`
          fixed left-0 top-1/2 transform -translate-y-1/2 z-[9999]
          w-6 h-12 bg-gray-800 hover:bg-gray-900 text-white
          rounded-r-md shadow-md
          flex items-center justify-center cursor-pointer
          transition-all duration-200
        `}
      >
        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isVisible ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Plate Menu */}
      <div 
        className={`
          fixed left-6 top-1/4 z-[9998]
          transition-all duration-200 ease-in-out
          ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
        `}
      >
        {/* Plate List */}
        <div className="flex min-h-[30vh] flex-col bg-white border border-gray-200 shadow-lg rounded-md w-40 max-h-[50vh]">
          {/* Plate List */}
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {plates.map((plate) => (
              <div
                key={plate.id}
                className={`
                  relative group cursor-pointer rounded-sm transition-colors duration-150
                  ${plate.isActive 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-gray-50'
                  }
                `}
                onClick={() => handlePlateClick(plate.id)}
                onDoubleClick={() => handleDoubleClick(plate.id, plate.name)}
              >
                {editingPlateId === plate.id ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="h-6  border-none px-2 py-1.5"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center justify-between px-2 py-1.5 min-h-[24px]">
                    <span className={`
                      text-xs truncate flex-1
                      ${plate.isActive ? 'text-blue-700 ' : 'text-gray-700'}
                    `}>
                      {plate.name}
                    </span>
                    
                    {/* Delete button - only show on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePlate(plate.id, plate.name)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100"
                    >
                      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Button at Bottom */}
          <div className="border-t border-gray-200 p-1">
            <Button 
              onClick={handleAddPlate}
              size="sm" 
              variant="ghost" 
              className="w-full justify-center h-6 text-xs hover:bg-gray-50"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}