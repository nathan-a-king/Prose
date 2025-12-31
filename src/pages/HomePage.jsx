import { useState, useEffect, useRef, useLayoutEffect, useCallback, lazy, Suspense, Fragment } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAgents } from '../contexts/AgentContext'
import { documentApi } from '../services/documentApi'
import { fileSystemApi, setupMenuListeners } from '../services/fileSystemApi'
import SyntaxHighlighter from '../components/SyntaxHighlighter'

// Lazy-loaded components for better code splitting
const MarkdownPreview = lazy(() => import('../components/MarkdownPreview'))
const AgentPanel = lazy(() => import('../components/agents/AgentPanel'))
const ChangeProposalPanel = lazy(() => import('../components/agents/ChangeProposalPanel'))
const PromptionsControlPanel = lazy(() => import('../components/agents/PromptionsControlPanel'))
const SettingsPanel = lazy(() => import('../components/settings/SettingsPanel'))

// Function to preprocess markdown to preserve blank lines
function preprocessMarkdown(text) {
  // Only add spacing for actual empty lines (3 or more consecutive newlines)
  return text.replace(/\n\s*\n\s*\n/g, '\n\n&nbsp;\n\n')
}

// Sorts recent files: pinned first (by recency), then unpinned (by recency)
function sortRecentFiles(files) {
  const pinned = files.filter(f => f.isPinned)
    .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened))
  const unpinned = files.filter(f => !f.isPinned)
    .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened))
  return [...pinned, ...unpinned]
}

// Applies file limit, preserving pinned files and removing oldest unpinned files
function limitRecentFiles(files, maxFiles) {
  if (files.length <= maxFiles) {
    return files
  }
  
  const pinnedFiles = files.filter(f => f.isPinned)
  const unpinnedFiles = files.filter(f => !f.isPinned)
  const remainingSlots = maxFiles - pinnedFiles.length
  return [...pinnedFiles, ...unpinnedFiles.slice(0, Math.max(0, remainingSlots))]
}

function HomePage() {
  const { isDarkMode, toggleTheme } = useTheme()
  const { documentState, initializeDocument, updateDocumentContent, getPendingProposals, updateCounter, selectedAgent, setCurrentPromptions, setSelectedAgent, executeAgent, isExecuting, executionProgress, changeProposals, cancelExecution } = useAgents()
  const [text, setText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentDocId, setCurrentDocId] = useState(null)
  const [currentFilePath, setCurrentFilePath] = useState(null) // For filesystem documents
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved'
  const [viewMode, setViewMode] = useState('edit') // 'edit', 'preview'
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [proposalPanelOpen, setProposalPanelOpen] = useState(false)
  const [steeringPanelOpen, setSteeringPanelOpen] = useState(false)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const previousProposalCountRef = useRef(0)
  const autoSaveTimeout = useRef(null)
  const textareaRef = useRef(null)
  const editorRef = useRef(null)
  const [documents, setDocuments] = useState([])
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [recentFiles, setRecentFiles] = useState([])
  const [editingDocId, setEditingDocId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')

  const handlePromptionsChange = useCallback((promptions) => {
    setCurrentPromptions(promptions)
  }, [setCurrentPromptions])

  const handleAgentSelected = useCallback((agentId) => {
    setSelectedAgent(agentId)
    setSteeringPanelOpen(true) // Auto-open panel when agent selected
    setAgentPanelOpen(false) // Close agent panel when steering panel opens
  }, [setSelectedAgent])

  // Set platform-specific padding for macOS traffic light buttons
  useEffect(() => {
    const isMac = window.navigator.userAgent.toLowerCase().includes('mac')
    document.documentElement.style.setProperty('--window-controls-offset', isMac ? '80px' : '0')
  }, [])

  // Set caret color based on theme
  useEffect(() => {
    const caretColor = isDarkMode ? '#f3f4f6' : '#111827'
    document.documentElement.style.setProperty('--editor-caret-color', caretColor)
  }, [isDarkMode])

  // Auto-open proposal panel when new proposals are generated
  useEffect(() => {
    const currentProposalCount = changeProposals.length
    const previousCount = previousProposalCountRef.current

    // Only auto-open if proposals increased (new proposals added)
    if (currentProposalCount > previousCount && currentProposalCount > 0) {
      setProposalPanelOpen(true)
      // Close other panels when opening proposals
      setSidebarOpen(false)
      setAgentPanelOpen(false)
      setSteeringPanelOpen(false)
    }

    previousProposalCountRef.current = currentProposalCount
  }, [changeProposals])

  // Load recent files from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('prose_recent_files')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Migration: add isPinned property to existing files
        const migrated = parsed.map(file => ({
          ...file,
          isPinned: file.isPinned ?? false
        }))
        localStorage.setItem('prose_recent_files', JSON.stringify(migrated))
        setRecentFiles(migrated)
      } catch (e) {
        console.error('Failed to parse recent files:', e)
      }
    }
    setLoadingDocuments(false)
  }, [])

  // Add file to recent files list
  const addToRecentFiles = useCallback((filePath, content) => {
    const fileName = fileSystemApi.getFileName(filePath)
    const preview = content.substring(0, 100).replace(/\n/g, ' ') + (content.length > 100 ? '...' : '')

    setRecentFiles(prev => {
      // Find existing file to preserve pin state
      const existing = prev.find(f => f.path === filePath)
      const isPinned = existing?.isPinned ?? false

      // Remove if already exists
      const filtered = prev.filter(f => f.path !== filePath)

      // Add to list with preserved/default pin state
      const updated = [{
        path: filePath,
        name: fileName,
        preview,
        lastOpened: new Date().toISOString(),
        isPinned
      }, ...filtered]

      // Sort first: pinned first, then by recency
      const sorted = sortRecentFiles(updated)

      // Apply 15-file limit, removing unpinned files first if needed
      const limited = limitRecentFiles(sorted, 15)

      // Save to localStorage
      localStorage.setItem('prose_recent_files', JSON.stringify(limited))
      return limited
    })
  }, [])

  // Initialize agent document state only when document changes (not on every keystroke)
  // After initialization, the textarea's onChange handler keeps DocumentState synced
  const lastDocIdRef = useRef(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    // Initialize when there's text (even without a currentDocId for new documents)
    if (text) {
      const currentDoc = documents.find(doc => doc.id === currentDocId)
      const docIdChanged = currentDocId !== lastDocIdRef.current

      // Initialize on document switch OR on first text entry
      if (docIdChanged || (!hasInitializedRef.current && !documentState)) {
        lastDocIdRef.current = currentDocId
        hasInitializedRef.current = true
        initializeDocument(text, {
          title: currentDoc?.title || (currentFilePath ? fileSystemApi.getFileName(currentFilePath) : 'Untitled Document'),
          documentId: currentDocId,
          filePath: currentFilePath
        })
      }
    } else {
      // Reset when text is cleared
      hasInitializedRef.current = false
    }
  }, [text, currentDocId, currentFilePath, documents, initializeDocument, documentState])

  // Keep textRef in sync with text state for comparison in sync effect
  const textRef = useRef(text)
  useEffect(() => {
    textRef.current = text
  }, [text])

  // Sync text with documentState when it changes from agent actions
  useEffect(() => {
    if (documentState && updateCounter > 0) {
      const stateContent = documentState.getContent()
      // Update text when proposals are approved (updateCounter changes)
      // Only update if content actually changed to avoid overwriting user edits
      // Use textRef.current to get latest value without triggering infinite loop
      if (stateContent && stateContent !== textRef.current) {
        setText(stateContent)
      }
    }
  }, [updateCounter, documentState])

  const saveDocument = useCallback(async () => {
    if (!text.trim()) return

    setSaveStatus('saving')

    try {
      // If we have a file path, save to filesystem
      if (currentFilePath) {
        await fileSystemApi.saveFile(currentFilePath, text)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
        return
      }

      // Otherwise save to database
      const preview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
      let savedDoc
      if (currentDocId) {
        // Update existing document
        const existingDoc = documents.find(doc => doc.id === currentDocId)
        const shouldUpdateTitle = !existingDoc?.title_manually_set
        const title = shouldUpdateTitle
          ? (text.split('\n')[0].substring(0, 50) || 'Untitled Document')
          : existingDoc.title

        savedDoc = await documentApi.update(currentDocId, title, text, preview, existingDoc?.title_manually_set || false)
        setDocuments(docs => docs.map(doc =>
          doc.id === currentDocId ? savedDoc : doc
        ))
      } else {
        // Create new document
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
      // Could show error notification here
    }
  }, [text, currentFilePath, currentDocId, documents, setDocuments, setCurrentDocId])

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
    }

    if (text.trim()) {
      autoSaveTimeout.current = setTimeout(() => {
        saveDocument()
      }, 3000) // Auto-save after 3 seconds of inactivity
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current)
      }
    }
  }, [text, saveDocument])

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (textareaRef.current && viewMode === 'edit') {
      // Use requestAnimationFrame to defer the resize
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const scrollTop = window.scrollY || document.documentElement.scrollTop

          // Reset height to get correct scrollHeight
          textareaRef.current.style.height = 'auto'
          const scrollHeight = textareaRef.current.scrollHeight
          // Add a small buffer (2px) to prevent the minimal scrollbar issue
          textareaRef.current.style.height = (scrollHeight + 2) + 'px'

          // Maintain scroll position
          window.scrollTo({ top: scrollTop, behavior: 'instant' })
        }
      })
    }
  }, [text, viewMode])

  const loadDocument = (doc) => {
    setText(doc.content)
    setCurrentDocId(doc.id)
    setCurrentFilePath(null) // Clear file path when loading from database
    setSidebarOpen(false)
  }

  const newDocument = useCallback(() => {
    setText('')
    setCurrentDocId(null)
    setCurrentFilePath(null)
    setSidebarOpen(false)
  }, [])

  // Open a file from the filesystem
  const openFile = useCallback(async () => {
    if (!fileSystemApi.isAvailable()) {
      console.log('File system API not available')
      return
    }

    try {
      const result = await fileSystemApi.openFile()
      if (result) {
        setText(result.content)
        setCurrentFilePath(result.filePath)
        setCurrentDocId(null) // Clear database document ID
        addToRecentFiles(result.filePath, result.content)
        setSidebarOpen(false)
      }
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }, [addToRecentFiles])

  // Open a recent file
  const openRecentFile = useCallback(async (filePath) => {
    if (!fileSystemApi.isAvailable()) return

    try {
      const content = await window.fileSystem.readFile(filePath)
      setText(content)
      setCurrentFilePath(filePath)
      setCurrentDocId(null)
      addToRecentFiles(filePath, content)
      setSidebarOpen(false)
    } catch (error) {
      console.error('Failed to open recent file:', error)
      // Remove from recent files if it doesn't exist
      setRecentFiles(prev => {
        const updated = prev.filter(f => f.path !== filePath)
        localStorage.setItem('prose_recent_files', JSON.stringify(updated))
        return updated
      })
    }
  }, [addToRecentFiles])

  // Toggle pin state for a recent file
  const togglePin = useCallback((filePath, e) => {
    e.stopPropagation() // Prevent opening the file

    setRecentFiles(prev => {
      const updated = prev.map(file =>
        file.path === filePath
          ? { ...file, isPinned: !file.isPinned }
          : file
      )

      const sorted = sortRecentFiles(updated)
      const limited = limitRecentFiles(sorted, 15)
      localStorage.setItem('prose_recent_files', JSON.stringify(limited))
      return limited
    })
  }, [])

  // Save file as (show save dialog)
  const saveFileAs = useCallback(async () => {
    if (!fileSystemApi.isAvailable()) {
      console.log('File system API not available')
      return
    }

    try {
      const defaultName = currentFilePath
        ? fileSystemApi.getFileName(currentFilePath)
        : (text.split('\n')[0].substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, '') || 'untitled') + '.md'

      const result = await fileSystemApi.saveFileAs(text, defaultName)
      if (result) {
        setCurrentFilePath(result.filePath)
        setCurrentDocId(null) // This is now a file system document
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
      }
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }, [text, currentFilePath])

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

  // Cleanup: abort any streaming requests when component unmounts
  useEffect(() => {
    return () => {
      console.log('[HomePage] Unmounting, ensuring any active execution is cancelled...')
      cancelExecution()
    }
  }, [cancelExecution])


  const deleteDocument = async (docId, e) => {
    e.stopPropagation() // Prevent loading the document when clicking delete
    
    console.log('Attempting to delete document with ID:', docId)
    
    try {
      console.log('Calling API delete...')
      await documentApi.delete(docId)
      console.log('API delete successful, updating UI...')
      setDocuments(docs => docs.filter(doc => doc.id !== docId))
      if (currentDocId === docId) {
        setText('')
        setCurrentDocId(null)
      }
      console.log('Delete operation completed')
    } catch (error) {
      console.error('Failed to delete document:', error)
      // Could show error notification here
    }
  }

  const startEditingTitle = (doc, e) => {
    e.stopPropagation() // Prevent loading the document when clicking rename
    setEditingDocId(doc.id)
    setEditingTitle(doc.title)
  }

  const saveRename = async (docId) => {
    if (!editingTitle.trim()) {
      cancelRename()
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
      // Could show error notification here
    }
  }

  const cancelRename = () => {
    setEditingDocId(null)
    setEditingTitle('')
  }

  // Formatting helper functions
  const insertFormatting = (before, after = '') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = text.substring(start, end)
    const beforeText = text.substring(0, start)
    const afterText = text.substring(end)

    const newText = beforeText + before + selectedText + after + afterText
    setText(newText)

    // Set cursor position after formatting
    setTimeout(() => {
      textarea.focus()
      if (selectedText) {
        textarea.setSelectionRange(start + before.length, end + before.length)
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length)
      }
    }, 0)
  }

  const insertHeading = (level) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const beforeText = text.substring(0, start)
    const afterText = text.substring(start)

    // Find the start of the current line
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
  }

  const insertList = (ordered = false) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const beforeText = text.substring(0, start)
    const afterText = text.substring(start)

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
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-neutral-800">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-gray-200/30 dark:border-neutral-700/30 draggable">
        {/* Main header content - single row layout */}
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 mac-window-padding">
            {/* Recent Files sidebar toggle */}
            <button
              onClick={() => {
                setSidebarOpen(!sidebarOpen)
                if (!sidebarOpen) {
                  setAgentPanelOpen(false)
                  setProposalPanelOpen(false)
                  setSteeringPanelOpen(false)
                }
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle recent files"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <img src="/images/prose.png" alt="Prose - Minimal Markdown Editor" className="h-10 w-auto dark:invert" />
          </div>
          <div className="flex items-center gap-4">
          {/* Current file indicator */}
          {currentFilePath && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 max-w-[200px]">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate" title={currentFilePath}>
                {fileSystemApi.getFileName(currentFilePath)}
              </span>
            </div>
          )}

          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-[80px]">
            {saveStatus === 'saving' && (
              <>
                <div
                  className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin-gpu"
                ></div>
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600 dark:text-green-400">Saved</span>
              </>
            )}
          </div>

          {/* Agent execution indicator */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin-gpu"
              ></div>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {executionProgress?.agentId ? `Running ${executionProgress.agentId.replace('-agent', '')}...` : 'Running agent...'}
              </span>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-neutral-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'edit' 
                  ? 'bg-white dark:bg-neutral-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'preview' 
                  ? 'bg-white dark:bg-neutral-600 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Preview
            </button>
          </div>
          
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Toggle dark mode"
          >
            {isDarkMode ? (
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Settings toggle */}
          <button
            onClick={() => setSettingsPanelOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Agent Pipeline toggle */}
          <button
            onClick={() => {
              setAgentPanelOpen(!agentPanelOpen)
              if (!agentPanelOpen) {
                setSidebarOpen(false)
                setProposalPanelOpen(false)
                setSteeringPanelOpen(false)
              }
            }}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
              agentPanelOpen ? 'bg-blue-100 dark:bg-blue-900/20' : ''
            }`}
            title="Toggle Agent Pipeline"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </button>

          {/* Steering controls toggle */}
          <button
            onClick={() => {
              setSteeringPanelOpen(!steeringPanelOpen)
              if (!steeringPanelOpen) {
                setSidebarOpen(false)
                setAgentPanelOpen(false)
                setProposalPanelOpen(false)
              }
            }}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
              steeringPanelOpen ? 'bg-blue-100 dark:bg-blue-900/20' : ''
            }`}
            title="Toggle steering controls"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          {/* Change Proposals toggle */}
          <button
            onClick={() => {
              setProposalPanelOpen(!proposalPanelOpen)
              if (!proposalPanelOpen) {
                setSidebarOpen(false)
                setAgentPanelOpen(false)
                setSteeringPanelOpen(false)
              }
            }}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative ${
              proposalPanelOpen ? 'bg-blue-100 dark:bg-blue-900/20' : ''
            }`}
            title="Toggle Change Proposals"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {getPendingProposals().length > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 relative bg-gray-100 dark:bg-neutral-800 min-h-full pt-24">
        {/* Recent Files Sidebar */}
        <div className={`fixed top-24 left-8 bottom-8 w-80 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-10 overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-96'
        }`}>
          <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Files</h2>
              <button
                onClick={openFile}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Open file (Cmd+O)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Recently opened markdown files</p>
          </div>
          <div className="overflow-y-auto overflow-x-hidden h-full pb-20">
            {loadingDocuments ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <div
                  className="w-6 h-6 border border-gray-400 border-t-transparent rounded-full animate-spin-gpu mx-auto mb-2"
                ></div>
                <p>Loading files...</p>
              </div>
            ) : recentFiles.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm mb-2">No recent files</p>
                <p className="text-xs">Press Cmd+O to open a file</p>
              </div>
            ) : (
              recentFiles.map((file, index) => {
                // Determine if we need a separator
                const prevFile = index > 0 ? recentFiles[index - 1] : null
                const showSeparator = prevFile?.isPinned && !file.isPinned

                return (
                  <Fragment key={file.path}>
                    {showSeparator && (
                      <div className="border-t border-gray-200 dark:border-neutral-600 my-2">
                        <div className="text-xs text-gray-400 dark:text-gray-500 px-4 py-1 uppercase tracking-wide">
                          Recent
                        </div>
                      </div>
                    )}
                    <div
                      onClick={() => openRecentFile(file.path)}
                      className={`p-4 border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer group transition-colors ${
                        currentFilePath === file.path ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {/* Pin button */}
                          <button
                            onClick={(e) => togglePin(file.path, e)}
                            className={`p-1 rounded transition-all flex-shrink-0 ${
                              file.isPinned
                                ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100'
                            }`}
                            title={file.isPinned ? 'Unpin file' : 'Pin file'}
                          >
                            <svg className="w-4 h-4" fill={file.isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>

                          <svg className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{file.path}</p>
                            {file.preview && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{file.preview}</p>
                            )}
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecentFiles(prev => {
                              const updated = prev.filter(f => f.path !== file.path)
                              localStorage.setItem('prose_recent_files', JSON.stringify(updated))
                              return updated
                            })
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Remove from recent"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Fragment>
                )
              })
            )}
          </div>
        </div>

        {/* Agent Panel */}
        <div className={`fixed top-24 left-8 bottom-8 w-96 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-20 ${
          agentPanelOpen ? 'translate-x-0' : '-translate-x-[28rem]'
        }`}>
          {agentPanelOpen && (
            <Suspense fallback={<div className="p-4 text-gray-500 dark:text-gray-400">Loading...</div>}>
              <AgentPanel
                onClose={() => setAgentPanelOpen(false)}
                onAgentSelected={handleAgentSelected}
              />
            </Suspense>
          )}
        </div>

        {/* Change Proposal Panel */}
        <div className={`fixed top-24 right-8 bottom-8 w-96 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-20 ${
          proposalPanelOpen ? 'translate-x-0' : 'translate-x-[28rem]'
        }`}>
          {proposalPanelOpen && (
            <Suspense fallback={<div className="p-4 text-gray-500 dark:text-gray-400">Loading...</div>}>
              <ChangeProposalPanel
                onClose={() => setProposalPanelOpen(false)}
                onApplyChange={(newContent) => setText(newContent)}
              />
            </Suspense>
          )}
        </div>

        {/* Promptions Control Panel */}
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[800px] max-w-[calc(100vw-4rem)] bg-white dark:bg-neutral-700 shadow-xl rounded-lg transition-transform duration-300 ease-in-out z-20 overflow-hidden ${
          steeringPanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%+4rem)]'
        }`}>
          {steeringPanelOpen && (
            <Suspense fallback={<div className="p-4 text-gray-500 dark:text-gray-400">Loading options...</div>}>
              <>
                <div className="p-4 border-b border-gray-200 dark:border-neutral-600 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {selectedAgent ? `Configure ${selectedAgent.replace(/-/g, ' ')}` : 'Agent Options'}
                  </h2>
                  <button
                    onClick={() => setSteeringPanelOpen(false)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-600 rounded transition-colors"
                    title="Close options panel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <PromptionsControlPanel
                    agentId={selectedAgent}
                    documentState={documentState}
                    onChange={handlePromptionsChange}
                  />
                </div>

                {/* Execute button */}
                <div className="p-4 border-t border-gray-200 dark:border-neutral-600 flex justify-end gap-2">
                  <button
                    onClick={() => setSteeringPanelOpen(false)}
                    className="px-4 py-2 text-sm border border-gray-200 dark:border-neutral-500 rounded-md text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAgent && !isExecuting) {
                        executeAgent(selectedAgent)
                        setSteeringPanelOpen(false)
                      }
                    }}
                    disabled={!selectedAgent || isExecuting}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isExecuting && (
                      <div
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin-gpu"
                      ></div>
                    )}
                    {isExecuting ? 'Running...' : 'Execute Agent'}
                  </button>
                </div>
              </>
            </Suspense>
          )}
        </div>

        {/* Settings Panel */}
        {settingsPanelOpen && (
          <Suspense fallback={null}>
            <SettingsPanel
              isOpen={settingsPanelOpen}
              onClose={() => setSettingsPanelOpen(false)}
            />
          </Suspense>
        )}

        {/* Floating Formatting Toolbar */}
        {viewMode === 'edit' && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-20 bg-white dark:bg-neutral-700 shadow-lg rounded-lg px-2 py-1.5 flex items-center gap-1 border border-gray-200 dark:border-neutral-600">
              {/* Heading dropdown */}
              <select
                onChange={(e) => e.target.value && insertHeading(parseInt(e.target.value))}
                className="px-2 py-1 text-sm bg-white dark:bg-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-600 rounded cursor-pointer outline-none text-gray-700 dark:text-gray-300 appearance-none pr-6"
                value=""
              >
                <option value="">H</option>
                <option value="1">H1</option>
                <option value="2">H2</option>
                <option value="3">H3</option>
              </select>
              
              <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />
              
              {/* Bold */}
              <button
                onClick={() => insertFormatting('**', '**')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Bold (Ctrl+B)"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
                </svg>
              </button>
              
              {/* Italic */}
              <button
                onClick={() => insertFormatting('*', '*')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Italic (Ctrl+I)"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
                </svg>
              </button>
              
              {/* Underline (using HTML tags in markdown) */}
              <button
                onClick={() => insertFormatting('<u>', '</u>')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Underline"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
                </svg>
              </button>
              
              {/* Strikethrough */}
              <button
                onClick={() => insertFormatting('~~', '~~')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Strikethrough"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12L8 8m4 4l4 4m-4-4l4-4m-4 4l-4 4" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18" />
                </svg>
              </button>
              
              <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />
              
              {/* Link */}
              <button
                onClick={() => insertFormatting('[', '](url)')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Insert link"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
              
              {/* Quote */}
              <button
                onClick={() => insertFormatting('> ', '')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Quote"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
                </svg>
              </button>
              
              {/* Code */}
              <button
                onClick={() => insertFormatting('`', '`')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Inline code"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </button>
              
              <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />
              
              {/* Numbered list */}
              <button
                onClick={() => insertList(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Numbered list"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5 5 5-5H7z" />
                  <text x="4" y="10" className="text-xs fill-current">1.</text>
                </svg>
              </button>
              
              {/* Bullet list */}
              <button
                onClick={() => insertList(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Bullet list"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />
              
              {/* Horizontal rule */}
              <button
                onClick={() => insertFormatting('\n---\n', '')}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Horizontal rule"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              
              {/* Clear formatting */}
              <button
                onClick={() => {
                  // Remove common markdown formatting from selected text
                  if (!textareaRef.current) return
                  const textarea = textareaRef.current
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const selectedText = text.substring(start, end)
                  const cleanText = selectedText.replace(/[*_~`\[\]()#>-]/g, '')
                  const beforeText = text.substring(0, start)
                  const afterText = text.substring(end)
                  setText(beforeText + cleanText + afterText)
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                title="Clear formatting"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.9,6.9l4.2,4.2l-4.2,4.2L11.5,14l2.8-2.8L11.5,8.4L12.9,6.9z M6.8,11.1h5.7v1.5H6.8V11.1z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h3m12 0h3" />
                </svg>
              </button>
          </div>
        )}

        {/* Main content */}
        <div className="w-[800px] mx-auto bg-white dark:bg-neutral-700 shadow-xl rounded-lg editor-container">
        {viewMode === 'edit' && (
          <div className="relative">
            {/* Syntax highlighting overlay - behind the textarea */}
              <div className="absolute inset-0 p-12 text-lg font-light font-sans pointer-events-none overflow-hidden text-gray-900 dark:text-gray-100 syntax-highlight-overlay">
                <SyntaxHighlighter text={text} />
              </div>
              {/* Actual textarea - transparent text but visible caret */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  const newText = e.target.value
                  setText(newText)
                  // Update document state immediately so agents always have current content
                  if (documentState) {
                    updateDocumentContent(newText, 'user')
                  }
                }}
                onKeyDown={(e) => {
                  // Handle Cmd+A (Mac) or Ctrl+A (Windows/Linux) for select all
                  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                    e.preventDefault()
                    if (textareaRef.current) {
                      textareaRef.current.select()
                    }
                  }
                }}
                placeholder=""
                className="relative w-full p-12 bg-transparent border-0 resize-none focus:outline-none text-transparent text-lg font-light font-sans markdown-editor-textarea caret-gray-900 dark:caret-gray-100"
                spellCheck="false"
              />
            </div>
            )}

            {viewMode === 'preview' && (
            <div className="p-16 preview-container">
              <Suspense fallback={
                <div className="flex items-center justify-center py-16">
                  <div className="text-gray-500 dark:text-gray-400">Loading preview...</div>
                </div>
              }>
                <MarkdownPreview text={text} preprocessMarkdown={preprocessMarkdown} />
              </Suspense>
            </div>
            )}
        </div>

      </div>
    </div>
  )
}

export default HomePage