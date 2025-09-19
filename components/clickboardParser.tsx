"use client"

import { useEffect, useRef } from "react"
import { useReactionsStore } from "@/store/data"
import { Reaction } from "@/app/type"
import { toast } from "sonner"

interface ClipboardParserProps {
  onParseSuccess?: (count: number) => void
  onParseError?: (error: string) => void
}

export default function ClipboardParser({ onParseSuccess, onParseError }: ClipboardParserProps) {
  const { setReactions, clearSelection, getActiveReactionList } = useReactionsStore()
  const idCounterRef = useRef(1)

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Ctrl+V (or Cmd+V on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "v") {
        try {
          // Read clipboard text
          const clipboardText = await navigator.clipboard.readText()

          if (!clipboardText.trim()) {
            console.log("Clipboard is empty")
            return
          }

          // Get the active reaction list
          const activeList = getActiveReactionList()
          if (!activeList) {
            toast.error("No active reaction list found")
            return
          }

          // Parse TSV data
          const rows = clipboardText.trim().split("\n")
          const parsedReactions: Reaction[] = []
          let currentId = idCounterRef.current
          let hasValidationErrors = false
          let errorMessages: string[] = []

          rows.forEach((row, rowIndex) => {
            const columns = row.split("\t")

            // Check for empty rows
            if (!row.trim()) {
              hasValidationErrors = true
              errorMessages.push(`第 ${rowIndex + 1}行: 为空`)
              return
            }

            // Support both 2-column and 3-column formats
            if (columns.length !== 2 && columns.length !== 3) {
              hasValidationErrors = true
              errorMessages.push(`第 ${rowIndex + 1} 行: 需要两列或三列，只找到 ${columns.length} 列`)
              return
            }

            let position = ''; // Sample position (empty for 2-column format)
            let name = '';
            let primerData = '';

            if (columns.length === 2) {
              // 2-column format: sample_name, primer (old way)
              name = columns[0].trim().replace(/\//g, "-")
              primerData = columns[1].trim()
            } else {
              // 3-column format: position, sample_name, primer (new way)
              position = columns[0].trim() // Sample position (can be empty)
              name = columns[1].trim().replace(/\//g, "-")
              primerData = columns[2].trim()
            }

            // Name and primer columns must have non-empty data
            if (!name || !primerData) {
              hasValidationErrors = true
              errorMessages.push(`第 ${rowIndex + 1} 行: 样品名称或引物为空`)
              return
            }

            // Check if primer column contains semicolon-separated values
            if (primerData.includes(";")) {
              // Split by semicolon and create separate entries
              const primers = primerData.split(";")
              let hasValidPrimers = false
              
              primers.forEach((primer) => {
                const trimmedPrimer = primer.trim()
                if (trimmedPrimer) {
                  hasValidPrimers = true
                  parsedReactions.push({
                    id: currentId.toString(),
                    name: name,
                    primer: trimmedPrimer,
                    state: 'unused',
                    plateId: undefined, // No plate assigned - global list
                    position: position || undefined // Include position if not empty
                  })
                  currentId++
                }
              })
              
              if (!hasValidPrimers) {
                hasValidationErrors = true
                errorMessages.push(`Row ${rowIndex + 1}: 引物不合规`)
              }
            } else {
              // Single entry
              parsedReactions.push({
                id: currentId.toString(),
                name: name,
                primer: primerData,
                state: 'unused',
                plateId: undefined, // No plate assigned - global list
                position: position || undefined // Include position if not empty
              })
              currentId++
            }
          })

          // If there are validation errors, show them and prevent action
          if (hasValidationErrors) {
            const errorMsg = `数据格式错误，共 ${errorMessages.length} 个问题`
            console.warn("Validation errors:", errorMessages)
            toast.error(errorMsg, {
              description: errorMessages.slice(0, 3).join("; ") + (errorMessages.length > 3 ? "..." : ""),
              duration: 5000,
            })
            onParseError?.(errorMsg)
            return
          }

          // Update the ID counter ref
          idCounterRef.current = currentId

          console.log("Parsed reactions:", parsedReactions)

          if (parsedReactions.length > 0) {
            // Clear current selection and update reactions in the ACTIVE list only
            clearSelection()
            setReactions(parsedReactions, activeList.id) // Pass the active list ID
            
            // Show success toast with more details
            toast.success(`成功读取 ${parsedReactions.length} 条反应到 ${activeList.name} 🧪!`, {
              duration: 2000,
            })
            
            // Call success callback
            onParseSuccess?.(parsedReactions.length)
            
            console.log(`Successfully updated reaction list "${activeList.name}" with ${parsedReactions.length} reactions`)
          } else {
            const errorMsg = "Clipboard 中没有找到合规数据"
            console.warn(errorMsg)
            toast.error(errorMsg, {
              description: "Please ensure your clipboard contains tab-separated data with 2 columns (name, primer) or 3 columns (position, name, primer).",
              duration: 3000,
            })
            onParseError?.(errorMsg)
          }
        } catch (error) {
          const errorMsg = `Error reading clipboard: ${error}`
          console.error(errorMsg)
          toast.error(errorMsg, {
            description: "Make sure you have clipboard permissions and are using a supported browser.",
            duration: 3000,
          })
          onParseError?.(errorMsg)
        }
      }
    }

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown)

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [setReactions, clearSelection, onParseSuccess, onParseError, getActiveReactionList])

  // This component is invisible - it doesn't render anything
  return null
}
