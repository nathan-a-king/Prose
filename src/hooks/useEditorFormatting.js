import { useCallback, useRef, useEffect } from 'react'

export function useEditorFormatting(textareaRef, text, setText) {
  const textRef = useRef(text)
  useEffect(() => {
    textRef.current = text
  }, [text])

  const insertFormatting = useCallback((before, after = '') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentText = textRef.current
    const selectedText = currentText.substring(start, end)
    const beforeText = currentText.substring(0, start)
    const afterText = currentText.substring(end)

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
  }, [textareaRef, setText])

  const insertHeading = useCallback((level) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const currentText = textRef.current
    const beforeText = currentText.substring(0, start)

    const lineStart = beforeText.lastIndexOf('\n') + 1
    const lineBeforeText = currentText.substring(0, lineStart)
    const currentLine = currentText.substring(lineStart)

    const headingPrefix = '#'.repeat(level) + ' '
    const newText = lineBeforeText + headingPrefix + currentLine
    setText(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart + headingPrefix.length, lineStart + headingPrefix.length)
    }, 0)
  }, [textareaRef, setText])

  const insertList = useCallback((ordered = false) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const currentText = textRef.current
    const beforeText = currentText.substring(0, start)

    const lineStart = beforeText.lastIndexOf('\n') + 1
    const lineBeforeText = currentText.substring(0, lineStart)
    const currentLine = currentText.substring(lineStart)

    const listPrefix = ordered ? '1. ' : '- '
    const newText = lineBeforeText + listPrefix + currentLine
    setText(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart + listPrefix.length, lineStart + listPrefix.length)
    }, 0)
  }, [textareaRef, setText])

  const clearFormatting = useCallback(() => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentText = textRef.current
    const selectedText = currentText.substring(start, end)
    const cleanText = selectedText.replace(/[*_~`\[\]()#>-]/g, '')
    const beforeText = currentText.substring(0, start)
    const afterText = currentText.substring(end)
    setText(beforeText + cleanText + afterText)
  }, [textareaRef, setText])

  return { insertFormatting, insertHeading, insertList, clearFormatting }
}
