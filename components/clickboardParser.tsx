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
  const { setReactions, clearSelection } = useReactionsStore()
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

         

          // Parse TSV data
          const rows = clipboardText.trim().split("\n")
          const parsedReactions: Reaction[] = []
          let currentId = idCounterRef.current

          rows.forEach((row) => {
            const columns = row.split("\t")

            // Default headers: name, primer
            const name = (columns[0] || "").trim().replace(/\//g, "-")
            const primerData = (columns[1] || "").trim()

            if (!name && !primerData) return // Skip completely empty rows

            // Check if primer column contains semicolon-separated values
            if (primerData.includes(";")) {
              // Split by semicolon and create separate entries
              const primers = primerData.split(";")
              primers.forEach((primer) => {
                const trimmedPrimer = primer.trim()
                if (trimmedPrimer || name) {
                  // Only add if there's at least a name or primer
                  parsedReactions.push({
                    id: currentId.toString(),
                    name: name || `Reaction ${currentId}`,
                    primer: trimmedPrimer || `Primer ${currentId}`,
                    state: 'unused',
                    plateId: undefined // No plate assigned - global list
                  })
                  currentId++
                }
              })
            } else {
              // Single entry
              parsedReactions.push({
                id: currentId.toString(),
                name: name || `Reaction ${currentId}`,
                primer: primerData || `Primer ${currentId}`,
                state: 'unused',
                plateId: undefined // No plate assigned - global list
              })
              currentId++
            }
          })

          // Update the ID counter ref
          idCounterRef.current = currentId

          console.log("Parsed reactions:", parsedReactions)

          if (parsedReactions.length > 0) {
            // Clear current selection and update reactions in store
            clearSelection()
            setReactions(parsedReactions)
            
            // Show success toast with more details
            toast.success(`成功读取 ${parsedReactions.length} 条反应🧪!`, {
              duration: 2000,
            })
            
            // Call success callback
            onParseSuccess?.(parsedReactions.length)
            
            console.log(`Successfully updated reaction list with ${parsedReactions.length} reactions`)
          } else {
            const errorMsg = "Clipboard 中没有找到合规数据"
            console.warn(errorMsg)
            toast.error(errorMsg, {
              description: "Please ensure your clipboard contains tab-separated data with reaction names and primers.",
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
  }, [setReactions, clearSelection, onParseSuccess, onParseError])

  // This component is invisible - it doesn't render anything
  return null
}
