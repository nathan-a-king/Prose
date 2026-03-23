import { useState, useRef, useEffect, useCallback } from 'react'
import { documentApi } from '../services/documentApi'
import { fileSystemApi, setupMenuListeners } from '../services/fileSystemApi'

export function useDocumentPersistence({ text, setText, addToRecentFiles }) {
  const [currentDocId, setCurrentDocId] = useState(null)
  const [currentFilePath, setCurrentFilePath] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [documents, setDocuments] = useState([])
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [editingDocId, setEditingDocId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const autoSaveTimeout = useRef(null)
  const saveDocumentRef = useRef(null)

  // Mark loading complete on mount (recent files loaded separately)
  useEffect(() => {
    setLoadingDocuments(false)
  }, [])

  const saveDocument = useCallback(async () => {
    if (!text.trim()) return

    setSaveStatus('saving')

    try {
      if (currentFilePath) {
        await fileSystemApi.saveFile(currentFilePath, text)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
        return
      }

      const preview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
      let savedDoc
      if (currentDocId) {
        let existingDoc
        setDocuments(docs => {
          existingDoc = docs.find(doc => doc.id === currentDocId)
          return docs
        })

        const shouldUpdateTitle = !existingDoc?.title_manually_set
        const title = shouldUpdateTitle
          ? (text.split('\n')[0].substring(0, 50) || 'Untitled Document')
          : existingDoc.title

        savedDoc = await documentApi.update(currentDocId, title, text, preview, existingDoc?.title_manually_set || false)
        setDocuments(docs => docs.map(doc =>
          doc.id === currentDocId ? savedDoc : doc
        ))
      } else {
        const title = text.split('\n')[0].substring(0, 50) || 'Untitled Document'
        savedDoc = await documentApi.create(title, text, preview, false)
        setDocuments(docs => [savedDoc, ...docs])
        setCurrentDocId(savedDoc.id)
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (error) {
      console.error('Failed to save document:', error)
      setSaveStatus('')
    }
  }, [text, currentFilePath, currentDocId])

  useEffect(() => {
    saveDocumentRef.current = saveDocument
  }, [saveDocument])

  // Auto-save
  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
    }

    if (text.trim()) {
      autoSaveTimeout.current = setTimeout(() => {
        if (saveDocumentRef.current) {
          saveDocumentRef.current()
        }
      }, 3000)
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current)
      }
    }
  }, [text])

  const loadDocument = useCallback((doc) => {
    setText(doc.content)
    setCurrentDocId(doc.id)
    setCurrentFilePath(null)
  }, [setText])

  const newDocument = useCallback(() => {
    setText('')
    setCurrentDocId(null)
    setCurrentFilePath(null)
  }, [setText])

  const openFile = useCallback(async () => {
    if (!fileSystemApi.isAvailable()) return

    try {
      const result = await fileSystemApi.openFile()
      if (result) {
        setText(result.content)
        setCurrentFilePath(result.filePath)
        setCurrentDocId(null)
        addToRecentFiles(result.filePath, result.content)
      }
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }, [setText, addToRecentFiles])

  const openRecentFile = useCallback(async (filePath) => {
    if (!fileSystemApi.isAvailable()) return

    try {
      const content = await window.fileSystem.readFile(filePath)
      setText(content)
      setCurrentFilePath(filePath)
      setCurrentDocId(null)
      addToRecentFiles(filePath, content)
    } catch (error) {
      console.error('Failed to open recent file:', error)
    }
  }, [setText, addToRecentFiles])

  const saveFileAs = useCallback(async () => {
    if (!fileSystemApi.isAvailable()) return

    try {
      const defaultName = currentFilePath
        ? fileSystemApi.getFileName(currentFilePath)
        : (text.split('\n')[0].substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, '') || 'untitled') + '.md'

      const result = await fileSystemApi.saveFileAs(text, defaultName)
      if (result) {
        setCurrentFilePath(result.filePath)
        setCurrentDocId(null)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
      }
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }, [text, currentFilePath])

  const deleteDocument = useCallback(async (docId, e) => {
    e.stopPropagation()

    try {
      await documentApi.delete(docId)
      setDocuments(docs => docs.filter(doc => doc.id !== docId))
      if (currentDocId === docId) {
        setText('')
        setCurrentDocId(null)
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }, [currentDocId, setText])

  const startEditingTitle = useCallback((doc, e) => {
    e.stopPropagation()
    setEditingDocId(doc.id)
    setEditingTitle(doc.title)
  }, [])

  const saveRename = useCallback(async (docId) => {
    if (!editingTitle.trim()) {
      setEditingDocId(null)
      setEditingTitle('')
      return
    }

    try {
      const doc = documents.find(d => d.id === docId)
      if (!doc) return

      const updatedDoc = await documentApi.update(docId, editingTitle.trim(), doc.content, doc.preview, true)
      setDocuments(docs => docs.map(d => d.id === docId ? updatedDoc : d))
      setEditingDocId(null)
      setEditingTitle('')
    } catch (error) {
      console.error('Failed to rename document:', error)
    }
  }, [editingTitle, documents])

  const cancelRename = useCallback(() => {
    setEditingDocId(null)
    setEditingTitle('')
  }, [])

  // Setup menu event listeners
  useEffect(() => {
    const cleanup = setupMenuListeners({
      onNewDocument: newDocument,
      onSaveDocument: saveDocument,
      onOpenFile: openFile,
      onSaveFileAs: saveFileAs
    })
    return cleanup
  }, [newDocument, saveDocument, openFile, saveFileAs])

  return {
    currentDocId, currentFilePath, saveStatus,
    documents, loadingDocuments,
    saveDocument, loadDocument, newDocument, openFile, openRecentFile,
    saveFileAs, deleteDocument,
    startEditingTitle, saveRename, cancelRename,
    editingDocId, editingTitle, setEditingTitle,
    setCurrentDocId, setCurrentFilePath, setDocuments
  }
}
