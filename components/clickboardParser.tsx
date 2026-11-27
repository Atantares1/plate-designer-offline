"use client"

import { useEffect } from "react"
import { ReactionDraft, useReactionsStore } from "@/store/data"
import { toast } from "sonner"

interface ClipboardParserProps {
  onParseSuccess?: (count: number) => void
  onParseError?: (error: string) => void
}

export default function ClipboardParser({ onParseSuccess, onParseError }: ClipboardParserProps) {
  const { setReactions, getActiveReactionList } = useReactionsStore()

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Ctrl+V (or Cmd+V on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        const target = event.target
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        ) {
          return
        }

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
          const parsedReactions: ReactionDraft[] = []
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

            const [nameColumn, primerColumn] = columns.slice(-2)
            const position = columns.length === 3 ? columns[0].trim() || undefined : undefined
            const nameParts = nameColumn.trim().split("/")
            const name = nameParts.join("-")
            const primerData = primerColumn.trim()

            // Name and primer columns must have non-empty data
            if (!name || !primerData) {
              hasValidationErrors = true
              errorMessages.push(`第 ${rowIndex + 1} 行: 样品名称或引物为空`)
              return
            }

            const primers = primerData.split(";").map(primer => primer.trim()).filter(Boolean)
            if (primers.length === 0) {
              hasValidationErrors = true
              errorMessages.push(`Row ${rowIndex + 1}: 引物不合规`)
              return
            }

            for (const primer of primers) {
              parsedReactions.push({
                name,
                sampleNameParts: nameParts.length > 1 ? nameParts : undefined,
                primer,
                state: 'unused',
                position
              })
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

          console.log("Parsed reactions:", parsedReactions)

          if (parsedReactions.length > 0) {
            // The store allocates globally unique IDs and replaces the list atomically.
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
          const isClipboardPermissionError =
            error instanceof DOMException &&
            (error.name === "NotAllowedError" || error.name === "SecurityError")
          const detail = error instanceof Error ? error.message : String(error)
          const errorMsg = isClipboardPermissionError
            ? "Unable to read clipboard"
            : "Unable to update reaction list"
          console.error(errorMsg)
          toast.error(errorMsg, {
            description: isClipboardPermissionError
              ? "Make sure clipboard permission is enabled."
              : detail,
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
  }, [setReactions, onParseSuccess, onParseError, getActiveReactionList])

  // This component is invisible - it doesn't render anything
  return null
}
