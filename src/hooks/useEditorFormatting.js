import { useCallback } from 'react'

export function useEditorFormatting(textareaRef, text, setText) {
  const insertFormatting = useCallback((before, after = '') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = text.substring(start, end)
    const beforeText = text.substring(0, start)
    const afterText = text.substring(end)

    const newText = beforeText + before + selectedText + after + afterText
    setText(newText)

    setTimeout(() => {
      textarea.focus()
      if (selectedText) {
        textarea.setSelectionRange(start + before.length, end + before.length)
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length)
      }
    }, 0)
  }, [textareaRef, text, setText])

  const insertHeading = useCallback((level) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const beforeText = text.substring(0, start)

    const lineStart = beforeText.lastIndexOf('\n') + 1
    const lineBeforeText = text.substring(0, lineStart)
    const currentLine = text.substring(lineStart)

    const headingPrefix = '#'.repeat(level) + ' '
    const newText = lineBeforeText + headingPrefix + currentLine
    setText(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart + headingPrefix.length, lineStart + headingPrefix.length)
    }, 0)
  }, [textareaRef, text, setText])

  const insertList = useCallback((ordered = false) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const beforeText = text.substring(0, start)

    const lineStart = beforeText.lastIndexOf('\n') + 1
    const lineBeforeText = text.substring(0, lineStart)
    const currentLine = text.substring(lineStart)

    const listPrefix = ordered ? '1. ' : '- '
    const newText = lineBeforeText + listPrefix + currentLine
    setText(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart + listPrefix.length, lineStart + listPrefix.length)
    }, 0)
  }, [textareaRef, text, setText])

  const clearFormatting = useCallback(() => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = text.substring(start, end)
    const cleanText = selectedText.replace(/[*_~`\[\]()#>-]/g, '')
    const beforeText = text.substring(0, start)
    const afterText = text.substring(end)
    setText(beforeText + cleanText + afterText)
  }, [textareaRef, text, setText])

  return { insertFormatting, insertHeading, insertList, clearFormatting }
}
