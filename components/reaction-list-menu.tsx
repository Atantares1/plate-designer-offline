"use client"

import { useState } from "react"
import { Plus, ChevronLeft, X } from "lucide-react"
import { useReactionsStore } from "@/store/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"

export function ReactionListMenu() {
  const { 
    reactionLists, 
    addReactionList, 
    renameReactionList, 
    removeReactionList, 
    setActiveReactionList,
    getReactionListById
  } = useReactionsStore()
  
  const { state } = useSidebar()
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [isVisible, setIsVisible] = useState(false)
  
  // Calculate dynamic positioning based on sidebar state
  const sidebarWidth = state === "expanded" ? "16rem" : "0rem"
  const buttonRight = `calc(${sidebarWidth} + 0px)`
  const menuRight = `calc(${sidebarWidth} + 12px)`
  
  // Don't render if sidebar state is not available yet
  if (!state) return null

  const handleAddList = () => {
    addReactionList()
    toast.success("新增反应列表!")
  }

  const handleDoubleClick = (listId: string, currentName: string) => {
    setEditingListId(listId)
    setEditName(currentName)
  }

  const handleSaveEdit = () => {
    if (editingListId && editName.trim()) {
      // Try to rename the list
      const success = renameReactionList(editingListId, editName.trim())
      
      if (success) {
        // Rename successful
        setEditingListId(null)
        setEditName("")
        toast.success("反应列表重命名成功!")
      } else {
        // Rename failed due to duplicate name
        toast.error(`重命名失败: 名称 "${editName.trim()}" 已存在!`)
        // Keep editing mode active so user can try a different name
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingListId(null)
    setEditName("")
  }

  const handleRemoveList = (listId: string, listName: string) => {
    if (reactionLists.length <= 1) {
      toast.error("无法删除最后一个反应列表!")
      return
    }
    
    removeReactionList(listId)
    toast.success(`反应列表 "${listName}" 已被删除!`)
  }

  const handleListClick = (listId: string) => {
    setActiveReactionList(listId)
  }

  const toggleMenu = () => {
    setIsVisible(!isVisible)
  }

  return (
    <>
             <button
         onClick={toggleMenu}
         className={`
           fixed top-1/2 transform -translate-y-1/2 z-[9999]
           w-6 h-12 bg-gray-800 hover:bg-gray-900 text-white
           rounded-l-md shadow-md
           flex items-center justify-center cursor-pointer
           transition-all duration-200
         `}
                   style={{
            right: buttonRight
          }}
       >
        <ChevronLeft className={`w-3 h-3 transition-transform duration-200 ${isVisible ? 'rotate-180' : ''}`} />
      </button>
      
             {/* Reaction List Menu */}
       <div 
         className={`
           fixed top-1/4 z-[9998]
           transition-all duration-200 ease-in-out
           ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
         `}
                   style={{
            right: menuRight
          }}
       >
                 {/* Reaction List */}
         <div className="flex min-h-[30vh] flex-col bg-white border border-gray-200 shadow-lg rounded-md w-24 max-h-[50vh]">
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {reactionLists.map((list) => (
              <div
                key={list.id}
                className={cn(
                  "relative group cursor-pointer rounded-sm transition-colors duration-150",
                  list.isActive 
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-gray-50'
                )}
                onClick={() => handleListClick(list.id)}
                onDoubleClick={() => handleDoubleClick(list.id, list.name)}
              >
                {editingListId === list.id ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="h-6 border-none px-2 py-1.5"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center justify-between px-2 py-1.5 min-h-[24px]">
                    <span className={cn(
                      "text-xs truncate flex-1",
                      list.isActive ? 'text-blue-700' : 'text-gray-700'
                    )}>
                      {list.name}
                    </span>
                    
                    {/* Delete button - only show on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveList(list.id, list.name)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Button at Bottom */}
          <div className="border-t border-gray-200 p-1">
            <Button 
              onClick={handleAddList}
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