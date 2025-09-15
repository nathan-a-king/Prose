import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useTheme } from '../contexts/ThemeContext'
import { documentApi } from '../services/documentApi'

// Function to preprocess markdown to preserve blank lines
function preprocessMarkdown(text) {
  // Only add spacing for actual empty lines (3 or more consecutive newlines)
  return text.replace(/\n\s*\n\s*\n/g, '\n\n&nbsp;\n\n')
}

function HomePage() {
  const { isDarkMode, toggleTheme } = useTheme()
  const [text, setText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentDocId, setCurrentDocId] = useState(null)
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved'
  const [viewMode, setViewMode] = useState('edit') // 'edit', 'preview'
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiQuestionLoading, setAiQuestionLoading] = useState(false)
  const autoSaveTimeout = useRef(null)
  const textareaRef = useRef(null)
  const [documents, setDocuments] = useState([])
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [editingDocId, setEditingDocId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [draggedDoc, setDraggedDoc] = useState(null)
  const [dragOverDocId, setDragOverDocId] = useState(null)
  const [dropPosition, setDropPosition] = useState('before') // 'before' or 'after'
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [pendingAiAction, setPendingAiAction] = useState(null)

  // Load documents from API on component mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoadingDocuments(true)
        const docs = await documentApi.getAll()
        // Documents are already ordered by display_order from the backend
        setDocuments(docs)
      } catch (error) {
        console.error('Failed to load documents:', error)
        // Fallback to localStorage if API fails
        const stored = localStorage.getItem('aiwriter_documents')
        if (stored) {
          try {
            setDocuments(JSON.parse(stored))
          } catch (e) {
            console.error('Failed to parse stored documents:', e)
          }
        }
      } finally {
        setLoadingDocuments(false)
      }
    }
    
    loadDocuments()
  }, [])

  const saveDocument = async () => {
    if (!text.trim()) return
    
    const preview = text.substring(0, 50) + (text.length > 50 ? '...' : '')
    
    setSaveStatus('saving')
    
    try {
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
  }

  const autoSave = async () => {
    if (text.trim()) {
      await saveDocument()
    }
  }

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
    }
    
    if (text.trim()) {
      autoSaveTimeout.current = setTimeout(() => {
        autoSave()
      }, 3000) // Auto-save after 3 seconds of inactivity
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current)
      }
    }
  }, [text])

  // Auto-resize textarea on mount and when text changes
  useLayoutEffect(() => {
    if (textareaRef.current && viewMode === 'edit') {
      // Use requestAnimationFrame to defer the resize
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const scrollTop = window.scrollY || document.documentElement.scrollTop
          const cursorPos = textareaRef.current.selectionStart

          // Temporarily disable scroll restoration to prevent interference
          const scrollBehavior = document.documentElement.style.scrollBehavior
          document.documentElement.style.scrollBehavior = 'auto'

          textareaRef.current.style.height = 'auto'
          const scrollHeight = textareaRef.current.scrollHeight
          // Add a small buffer (2px) to prevent the minimal scrollbar issue
          textareaRef.current.style.height = (scrollHeight + 2) + 'px'

          // Force scroll position
          window.scrollTo({ top: scrollTop, behavior: 'instant' })

          // Restore cursor position
          textareaRef.current.setSelectionRange(cursorPos, cursorPos)

          // Restore scroll behavior
          document.documentElement.style.scrollBehavior = scrollBehavior
        }
      })
    }
  }, [text, viewMode])

  const loadDocument = (doc) => {
    setText(doc.content)
    setCurrentDocId(doc.id)
    setSidebarOpen(false)
  }

  const newDocument = () => {
    setText('')
    setCurrentDocId(null)
    setSidebarOpen(false)
  }

  const getApiKey = () => {
    return new Promise((resolve) => {
      // Try to get API key from environment variable or localStorage
      let apiKey = import.meta.env.VITE_OPENAI_API_KEY
      
      if (!apiKey) {
        apiKey = localStorage.getItem('openai_api_key')
      }
      
      if (apiKey) {
        resolve(apiKey)
      } else {
        // Show modal to get API key from user
        setPendingAiAction(() => resolve)
        setShowApiKeyModal(true)
      }
    })
  }

  const handleApiKeySubmit = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('openai_api_key', apiKeyInput.trim())
      setShowApiKeyModal(false)
      if (pendingAiAction) {
        pendingAiAction(apiKeyInput.trim())
        setPendingAiAction(null)
      }
      setApiKeyInput('')
    }
  }

  const handleApiKeyCancel = () => {
    setShowApiKeyModal(false)
    setPendingAiAction(null)
    setApiKeyInput('')
  }

  const askAIQuestion = async (question) => {
    setAiQuestionLoading(true)
    
    try {
      const apiKey = await getApiKey()
      
      if (!apiKey) {
        throw new Error('No API key provided')
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful writing assistant. Answer the user\'s question about their document. Be concise and helpful. If the document is relevant to the question, reference specific parts of it.'
            },
            {
              role: 'user',
              content: `Document content:\n\n${text}\n\nQuestion: ${question}`
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API request failed: ${response.status} ${errorData.error?.message || ''}`)
      }

      const data = await response.json()
      const answer = data.choices[0].message.content

      // Add the Q&A to the suggestions list
      const newSuggestion = {
        title: `Q: ${question}`,
        content: answer
      }
      
      setAiSuggestions(prev => [newSuggestion, ...prev])
      setAiQuestion('')
      
    } catch (error) {
      console.error('Error asking AI question:', error)
      const errorSuggestion = {
        title: 'Error',
        content: `Failed to get answer: ${error.message}`
      }
      setAiSuggestions(prev => [errorSuggestion, ...prev])
    } finally {
      setAiQuestionLoading(false)
    }
  }

  const generateAISuggestions = async () => {
    console.log('Generate AI suggestions clicked')
    console.log('Current text:', text.substring(0, 100) + '...')
    
    setAiLoading(true)
    setAiSuggestions([])
    
    try {
      const apiKey = await getApiKey()
      
      if (!apiKey) {
        throw new Error('No API key provided')
      }
      
      console.log('Making API request...')
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful writing assistant. Analyze the given text and provide 3-4 specific, actionable suggestions to improve the writing. Focus on structure, clarity, engagement, and content development. Format each suggestion with a brief title and detailed explanation.'
            },
            {
              role: 'user',
              content: `Please analyze this text and provide writing suggestions:\n\n${text}`
            }
          ],
          max_tokens: 800,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, errorData)
        throw new Error(`API request failed: ${response.status} ${errorData.error?.message || ''}`)
      }

      const data = await response.json()
      console.log('API Response:', data)
      const suggestions = data.choices[0].message.content

      // Parse the AI response into individual suggestions
      const suggestionItems = suggestions.split('\n\n').filter(item => item.trim()).map((item, index) => ({
        title: `Suggestion ${index + 1}`,
        content: item.trim()
      }))

      console.log('Parsed suggestions:', suggestionItems)
      setAiSuggestions(suggestionItems)
    } catch (error) {
      console.error('Error generating AI suggestions:', error)
      setAiSuggestions([{
        title: 'Error',
        content: `Failed to generate suggestions: ${error.message}`
      }])
    } finally {
      setAiLoading(false)
    }
  }

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

  // Drag and Drop handlers
  const handleDragStart = (e, doc) => {
    setDraggedDoc(doc)
    e.dataTransfer.effectAllowed = 'move'
    // Add dragging class after a slight delay to prevent immediate visual feedback
    setTimeout(() => {
      e.target.classList.add('opacity-50')
    }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50')
    setDraggedDoc(null)
    setDragOverDocId(null)
  }

  const handleDragOver = (e, doc) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Only update if we're actually over a different document
    if (draggedDoc && draggedDoc.id !== doc.id) {
      const draggedIndex = documents.findIndex(d => d.id === draggedDoc.id)
      const targetIndex = documents.findIndex(d => d.id === doc.id)
      
      // Determine if we're dragging up or down
      if (draggedIndex < targetIndex) {
        // Dragging down - show indicator below the target
        setDropPosition('after')
      } else {
        // Dragging up - show indicator above the target
        setDropPosition('before')
      }
      
      setDragOverDocId(doc.id)
    }
  }

  const handleDragLeave = (e) => {
    // Only reset if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverDocId(null)
    }
  }

  const handleDrop = async (e, targetDoc) => {
    e.preventDefault()
    
    if (!draggedDoc || draggedDoc.id === targetDoc.id) {
      setDragOverDocId(null)
      return
    }

    // Find indices
    const draggedIndex = documents.findIndex(doc => doc.id === draggedDoc.id)
    const targetIndex = documents.findIndex(doc => doc.id === targetDoc.id)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDragOverDocId(null)
      return
    }

    // Create new array with reordered documents
    const newDocuments = [...documents]
    const [removed] = newDocuments.splice(draggedIndex, 1)
    
    // Adjust insertion index based on drop position
    let insertIndex = targetIndex
    if (dropPosition === 'after') {
      // If dropping after, we need to adjust the index
      insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1
    } else {
      // If dropping before
      insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
    }
    
    newDocuments.splice(insertIndex, 0, removed)

    // Update state immediately for responsive UI
    setDocuments(newDocuments)
    setDragOverDocId(null)

    // Persist the new order to the backend
    try {
      // Create array of document orders with their new positions
      const documentOrders = newDocuments.map((doc, index) => ({
        id: doc.id,
        order: index
      }))
      
      // Call API to update order in database
      await documentApi.updateOrder(documentOrders)
    } catch (error) {
      console.error('Failed to save document order:', error)
      // Revert the order on error
      setDocuments(documents)
      // Optionally show an error notification to the user
    }
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
          <div className="flex items-center gap-4" style={{ paddingLeft: window.navigator.userAgent.toLowerCase().includes('mac') ? '80px' : '0' }}>
            {/* Document sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle documents"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src="/images/prose.png" alt="Prose - Minimal Markdown Editor" className="h-10 w-auto dark:invert" />
          </div>
          <div className="flex items-center gap-4">
          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-[80px]">
            {saveStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
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
          
          {/* AI suggestions toggle */}
          <button
            onClick={() => setAiSidebarOpen(!aiSidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Toggle AI suggestions"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 relative bg-gray-100 dark:bg-neutral-800 min-h-full pt-24">
        {/* Document Sidebar */}
        <div className={`fixed top-24 left-8 bottom-8 w-80 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-10 overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-96'
        }`}>
          <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Documents</h2>
              <div className="flex gap-2">
                <button
                  onClick={saveDocument}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                  title="Save document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </button>
                <button
                  onClick={newDocument}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
                  title="New document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto overflow-x-hidden h-full pb-20">
            {loadingDocuments ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <div className="w-6 h-6 border border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p>Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <p>No documents yet. Create your first document!</p>
              </div>
            ) : (
              documents.map((doc) => (
              <div 
                key={doc.id} 
                onClick={() => loadDocument(doc)}
                draggable
                onDragStart={(e) => handleDragStart(e, doc)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, doc)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, doc)}
                className={`p-4 border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer group transition-all duration-200 ${
                  currentDocId === doc.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                } ${
                  dragOverDocId === doc.id && dropPosition === 'before' ? 'border-t-2 border-t-blue-500 pt-6' : ''
                } ${
                  dragOverDocId === doc.id && dropPosition === 'after' ? 'border-b-2 border-b-blue-500 pb-6' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {/* Drag handle */}
                    <div className="mt-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-12h2v2h-2V5zm0 4h2v2h-2V9zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                    {editingDocId === doc.id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveRename(doc.id)
                            } else if (e.key === 'Escape') {
                              cancelRename()
                            }
                          }}
                          onBlur={() => saveRename(doc.id)}
                          autoFocus
                          className="w-full font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-neutral-600 border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{doc.preview}</p>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{doc.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{doc.preview}</p>
                      </>
                    )}
                    </div>
                  </div>
                  <div className="flex ml-2 gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0">
                    <button
                      onClick={(e) => startEditingTitle(doc, e)}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="Rename document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => deleteDocument(doc.id, e)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      title="Delete document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </div>

        {/* AI suggestions sidebar */}
        <div className={`fixed top-24 right-8 bottom-8 w-80 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-10 flex flex-col ${
          aiSidebarOpen ? 'translate-x-0' : 'translate-x-96'
        }`}>
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Suggestions</h2>
              <button
                onClick={() => {
                  setAiLoading(false)
                  generateAISuggestions()
                }}
                disabled={aiLoading || !text.trim()}
                className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                title={`Generate suggestions ${aiLoading ? '(loading...)' : ''}`}
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {aiSuggestions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p>Click the lightning icon to get AI suggestions for your writing</p>
              </div>
            ) : (
              aiSuggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">{suggestion.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{suggestion.content}</p>
                </div>
              ))
            )}
          </div>
          
          {/* AI Question Input - Fixed at bottom */}
          <div className="flex-shrink-0 p-4 bg-white dark:bg-neutral-700 border-t border-gray-200 dark:border-neutral-600 rounded-b-lg">
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                if (aiQuestion.trim() && !aiQuestionLoading) {
                  askAIQuestion(aiQuestion)
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask a question..."
                disabled={aiQuestionLoading}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!aiQuestion.trim() || aiQuestionLoading}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiQuestionLoading ? (
                  <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Floating Formatting Toolbar */}
        {viewMode === 'edit' && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-20 bg-white dark:bg-neutral-700 shadow-lg rounded-lg px-2 py-1.5 flex items-center gap-1 border border-gray-200 dark:border-neutral-600">
              {/* Heading dropdown */}
              <select 
                onChange={(e) => e.target.value && insertHeading(parseInt(e.target.value))}
                className="px-2 py-1 text-sm bg-white dark:bg-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-600 rounded cursor-pointer outline-none text-gray-700 dark:text-gray-300 appearance-none pr-6"
                style={{ backgroundImage: 'none' }}
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
        <div className="w-[800px] mx-auto bg-white dark:bg-neutral-700 shadow-xl rounded-lg">
          {viewMode === 'edit' && (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                // Resize is handled by useLayoutEffect to avoid scrolling issues
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
              placeholder="Start writing markdown..."
              className="w-full p-12 bg-transparent border-0 resize-none focus:outline-none text-gray-900 dark:text-gray-100 text-lg font-light placeholder:text-gray-400 dark:placeholder:text-gray-500 font-sans"
              style={{ minHeight: '11in', lineHeight: '1.9', fontFamily: 'Avenir, Avenir Next, -apple-system, sans-serif' }}
            />
            )}
            
            {viewMode === 'preview' && (
            <div className="p-16" style={{ minHeight: '11in' }}>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    p: ({ children }) => {
                      if (!children || (Array.isArray(children) && children.length === 0)) {
                        return <div className="h-6" />;
                      }
                      return <p className="mb-6 text-lg leading-relaxed text-gray-700 dark:text-gray-300 text-justify font-light font-sans" style={{ lineHeight: '1.8', fontFamily: 'Avenir, Avenir Next, -apple-system, sans-serif' }}>{children}</p>;
                    },
                    h1: ({ children }) => <h1 className="text-4xl font-normal text-gray-900 dark:text-gray-100 mb-8 mt-2 text-center" style={{ lineHeight: '1.2', fontWeight: '400' }}>{children}</h1>,
                    h2: ({ children }) => <h2 className="text-3xl font-normal text-gray-900 dark:text-gray-100 mb-6 mt-8" style={{ lineHeight: '1.3', fontWeight: '400' }}>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-4 mt-6" style={{ lineHeight: '1.4', fontWeight: '400' }}>{children}</h3>,
                    h4: ({ children }) => <h4 className="text-xl font-normal text-gray-900 dark:text-gray-100 mb-3 mt-4" style={{ lineHeight: '1.4', fontWeight: '400' }}>{children}</h4>,
                    h5: ({ children }) => <h5 className="text-lg font-normal text-gray-900 dark:text-gray-100 mb-3 mt-4" style={{ lineHeight: '1.5', fontWeight: '400' }}>{children}</h5>,
                    h6: ({ children }) => <h6 className="text-base font-normal text-gray-900 dark:text-gray-100 mb-3 mt-4" style={{ lineHeight: '1.5', fontWeight: '400' }}>{children}</h6>,
                    ul: ({ children }) => <ul className="mb-6 list-disc pl-6 space-y-2 text-lg text-gray-700 dark:text-gray-300 font-light">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-6 list-decimal pl-6 space-y-2 text-lg text-gray-700 dark:text-gray-300 font-light">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed" style={{ lineHeight: '1.8' }}>{children}</li>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-neutral-600 pl-6 my-6 italic text-gray-700 dark:text-gray-300">{children}</blockquote>,
                    code: ({ inline, children }) => {
                      if (inline) {
                        return <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-700 text-sm font-mono rounded text-gray-800 dark:text-gray-200">{children}</code>;
                      }
                      return <code>{children}</code>;
                    },
                    pre: ({ children }) => (
                      <pre className="mb-6 p-4 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg overflow-x-auto">
                        <code className="text-gray-800 dark:text-gray-200">{children}</code>
                      </pre>
                    ),
                    strong: ({ children }) => <strong className="font-medium text-gray-900 dark:text-gray-100">{children}</strong>,
                    a: ({ href, children }) => {
                      const handleClick = (e) => {
                        // In Electron, the main process will handle external links
                        // via the will-navigate event, so we just need to handle
                        // the fallback for web browsers
                        if (!href?.startsWith('http://localhost')) {
                          e.preventDefault();
                          window.open(href, '_blank', 'noopener,noreferrer');
                        }
                      };
                      return (
                        <a
                          href={href}
                          onClick={handleClick}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-1 underline-offset-2 cursor-pointer"
                        >
                          {children}
                        </a>
                      );
                    }
                  }}
                >
                  {preprocessMarkdown(text) || '# Start writing some markdown!\n\nYour preview will appear here.'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-96 max-w-md mx-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                OpenAI API Key Required
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Please enter your OpenAI API key to use AI features. It will be saved locally for future use.
              </p>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleApiKeySubmit()
                  } else if (e.key === 'Escape') {
                    handleApiKeyCancel()
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleApiKeyCancel}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApiKeySubmit}
                  disabled={!apiKeyInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save Key
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage