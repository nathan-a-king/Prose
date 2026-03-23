import { useState, useEffect, useRef, useLayoutEffect, useCallback, lazy, Suspense } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAgents } from '../contexts/AgentContext'
import { fileSystemApi } from '../services/fileSystemApi'
import SyntaxHighlighter from '../components/SyntaxHighlighter'
import { usePanelManager, PANELS } from '../hooks/usePanelManager'
import { useRecentFiles } from '../hooks/useRecentFiles'
import { useDocumentPersistence } from '../hooks/useDocumentPersistence'
import { useEditorFormatting } from '../hooks/useEditorFormatting'
import RecentFilesSidebar from '../components/sidebar/RecentFilesSidebar'
import FormattingToolbar from '../components/editor/FormattingToolbar'

// Lazy-loaded components for better code splitting
const MarkdownPreview = lazy(() => import('../components/MarkdownPreview'))
const AgentPanel = lazy(() => import('../components/agents/AgentPanel'))
const ChangeProposalPanel = lazy(() => import('../components/agents/ChangeProposalPanel'))
const SettingsPanel = lazy(() => import('../components/settings/SettingsPanel'))

// Function to preprocess markdown to preserve blank lines
function preprocessMarkdown(text) {
  return text.replace(/\n\s*\n\s*\n/g, '\n\n&nbsp;\n\n')
}

function HomePage() {
  const { isDarkMode, toggleTheme } = useTheme()
  const { documentState, documentContent, initializeDocument, updateDocumentContent, getPendingProposals, selectedAgent, setSelectedAgent, executeAgent, isExecuting, executionProgress, changeProposals, cancelExecution } = useAgents()

  const [text, setText] = useState('')
  const [viewMode, setViewMode] = useState('edit')
  const textareaRef = useRef(null)
  const editModeScrollRef = useRef(0)
  const previewModeScrollRef = useRef(0)
  const previousProposalCountRef = useRef(0)

  // Hooks
  const panels = usePanelManager()
  const recentFiles = useRecentFiles()
  const persistence = useDocumentPersistence({
    text,
    setText,
    addToRecentFiles: recentFiles.addToRecentFiles
  })
  const formatting = useEditorFormatting(textareaRef, text, setText)

  // Handle view mode changes with scroll position preservation
  const handleViewModeChange = useCallback((newMode) => {
    if (newMode === viewMode) return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight
    const clientHeight = document.documentElement.clientHeight
    const maxScroll = scrollHeight - clientHeight

    if (maxScroll > 0) {
      const percent = scrollTop / maxScroll
      if (viewMode === 'edit') {
        editModeScrollRef.current = percent
      } else {
        previewModeScrollRef.current = percent
      }
    }

    setViewMode(newMode)
  }, [viewMode])

  const handleAgentSelected = useCallback((agentId) => {
    setSelectedAgent(agentId)
    if (!isExecuting) {
      executeAgent(agentId)
    }
    panels.closePanel()
  }, [setSelectedAgent, isExecuting, executeAgent, panels])

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

    if (currentProposalCount > previousCount && currentProposalCount > 0) {
      panels.openPanel(PANELS.PROPOSAL)
    }

    previousProposalCountRef.current = currentProposalCount
  }, [changeProposals, panels])

  // Initialize agent document state only when document changes
  const lastDocIdRef = useRef(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (text) {
      const currentDoc = persistence.documents.find(doc => doc.id === persistence.currentDocId)
      const docIdChanged = persistence.currentDocId !== lastDocIdRef.current

      if (docIdChanged || (!hasInitializedRef.current && !documentState)) {
        lastDocIdRef.current = persistence.currentDocId
        hasInitializedRef.current = true
        initializeDocument(text, {
          title: currentDoc?.title || (persistence.currentFilePath ? fileSystemApi.getFileName(persistence.currentFilePath) : 'Untitled Document'),
          documentId: persistence.currentDocId,
          filePath: persistence.currentFilePath
        })
      }
    } else {
      hasInitializedRef.current = false
    }
  }, [text, persistence.currentDocId, persistence.currentFilePath, persistence.documents, initializeDocument, documentState])

  // Keep textRef in sync with text state for comparison in sync effect
  const textRef = useRef(text)
  useEffect(() => {
    textRef.current = text
  }, [text])

  // Sync text with documentState when content changes from agent actions
  useEffect(() => {
    if (documentContent && documentContent !== textRef.current) {
      setText(documentContent)
    }
  }, [documentContent])

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (textareaRef.current && viewMode === 'edit') {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const scrollTop = window.scrollY || document.documentElement.scrollTop
          const selectionStart = textareaRef.current.selectionStart
          const selectionEnd = textareaRef.current.selectionEnd

          textareaRef.current.style.height = 'auto'
          const scrollHeight = textareaRef.current.scrollHeight
          textareaRef.current.style.height = (scrollHeight + 2) + 'px'

          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(selectionStart, selectionEnd)
          }

          window.scrollTo({ top: scrollTop, behavior: 'instant' })
        }
      })
    }
  }, [text, viewMode])

  // Restore scroll position after view mode changes
  useLayoutEffect(() => {
    const savedPercent = viewMode === 'edit'
      ? editModeScrollRef.current
      : previewModeScrollRef.current

    if (savedPercent > 0) {
      requestAnimationFrame(() => {
        const scrollHeight = document.documentElement.scrollHeight
        const clientHeight = document.documentElement.clientHeight
        const maxScroll = scrollHeight - clientHeight

        if (maxScroll > 0) {
          const targetScroll = savedPercent * maxScroll
          window.scrollTo({ top: targetScroll, behavior: 'instant' })
        }
      })
    }
  }, [viewMode])

  // Cleanup: abort any streaming requests when component unmounts
  useEffect(() => {
    return () => {
      cancelExecution()
    }
  }, [cancelExecution])

  // Wrapper callbacks for panel-aware document operations
  const handleLoadDocument = useCallback((doc) => {
    persistence.loadDocument(doc)
    panels.closePanel()
    editModeScrollRef.current = 0
    previewModeScrollRef.current = 0
  }, [persistence, panels])

  const handleNewDocument = useCallback(() => {
    persistence.newDocument()
    panels.closePanel()
    editModeScrollRef.current = 0
    previewModeScrollRef.current = 0
  }, [persistence, panels])

  const handleOpenFile = useCallback(async () => {
    await persistence.openFile()
    panels.closePanel()
    editModeScrollRef.current = 0
    previewModeScrollRef.current = 0
  }, [persistence, panels])

  const handleOpenRecentFile = useCallback(async (filePath) => {
    await persistence.openRecentFile(filePath)
    panels.closePanel()
    editModeScrollRef.current = 0
    previewModeScrollRef.current = 0
  }, [persistence, panels])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-neutral-800">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm border-b border-gray-200/30 dark:border-neutral-700/30 draggable">
        <div className="px-6 py-4 grid grid-cols-3 items-center">
          {/* Left section */}
          <div className="flex items-center gap-4 mac-window-padding">
            <button
              onClick={() => panels.togglePanel(PANELS.SIDEBAR)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Toggle recent files"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <img src="/images/prose.png" alt="Prose - Minimal Markdown Editor" className="h-10 w-auto dark:invert" />
          </div>

          {/* Center section - filename */}
          <div className="flex justify-center">
            {persistence.currentFilePath && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate" title={persistence.currentFilePath}>
                  {fileSystemApi.getFileName(persistence.currentFilePath)}
                </span>
              </div>
            )}
          </div>

          {/* Right section - controls */}
          <div className="flex items-center gap-4 justify-end">
          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 min-w-[80px]">
            {persistence.saveStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin-gpu"></div>
                <span>Saving...</span>
              </>
            )}
            {persistence.saveStatus === 'saved' && (
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
              <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin-gpu"></div>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {executionProgress?.agentId ? `Running ${executionProgress.agentId.replace('-agent', '')}...` : 'Running agent...'}
              </span>
            </div>
          )}

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
            onClick={() => panels.openPanel(PANELS.SETTINGS)}
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
            onClick={() => panels.togglePanel(PANELS.AGENT)}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
              panels.isPanelOpen(PANELS.AGENT) ? 'bg-blue-100 dark:bg-blue-900/20' : ''
            }`}
            title="Toggle Agent Pipeline"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </button>

          {/* Change Proposals toggle */}
          <button
            onClick={() => panels.togglePanel(PANELS.PROPOSAL)}
            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative ${
              panels.isPanelOpen(PANELS.PROPOSAL) ? 'bg-blue-100 dark:bg-blue-900/20' : ''
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
        <RecentFilesSidebar
          recentFiles={recentFiles.recentFiles}
          isOpen={panels.isPanelOpen(PANELS.SIDEBAR)}
          currentFilePath={persistence.currentFilePath}
          loadingDocuments={persistence.loadingDocuments}
          onOpenFile={handleOpenFile}
          onOpenRecentFile={handleOpenRecentFile}
          onTogglePin={recentFiles.togglePin}
          onRemoveFile={recentFiles.removeFromRecent}
        />

        {/* Agent Panel */}
        <div className={`fixed top-24 left-8 bottom-8 w-96 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-20 ${
          panels.isPanelOpen(PANELS.AGENT) ? 'translate-x-0' : '-translate-x-[28rem]'
        }`}>
          {panels.isPanelOpen(PANELS.AGENT) && (
            <Suspense fallback={<div className="p-4 text-gray-500 dark:text-gray-400">Loading...</div>}>
              <AgentPanel
                onClose={panels.closePanel}
                onAgentSelected={handleAgentSelected}
              />
            </Suspense>
          )}
        </div>

        {/* Change Proposal Panel */}
        <div className={`fixed top-24 right-8 bottom-8 w-96 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-20 ${
          panels.isPanelOpen(PANELS.PROPOSAL) ? 'translate-x-0' : 'translate-x-[28rem]'
        }`}>
          {panels.isPanelOpen(PANELS.PROPOSAL) && (
            <Suspense fallback={<div className="p-4 text-gray-500 dark:text-gray-400">Loading...</div>}>
              <ChangeProposalPanel
                onClose={panels.closePanel}
                onApplyChange={(newContent) => setText(newContent)}
              />
            </Suspense>
          )}
        </div>

        {/* Settings Panel */}
        {panels.isPanelOpen(PANELS.SETTINGS) && (
          <Suspense fallback={null}>
            <SettingsPanel
              isOpen={true}
              onClose={panels.closePanel}
            />
          </Suspense>
        )}

        {/* Floating Formatting Toolbar */}
        {viewMode === 'edit' && (
          <FormattingToolbar
            insertFormatting={formatting.insertFormatting}
            insertHeading={formatting.insertHeading}
            insertList={formatting.insertList}
            clearFormatting={formatting.clearFormatting}
          />
        )}

        {/* Main content */}
        <div className="w-[800px] mx-auto bg-white dark:bg-neutral-700 shadow-xl rounded-lg editor-container">
        {viewMode === 'edit' && (
          <div className="relative">
            {/* Syntax highlighting overlay */}
              <div className="absolute inset-0 p-12 text-base font-light font-sans pointer-events-none overflow-hidden text-gray-700 dark:text-gray-300 syntax-highlight-overlay">
                <SyntaxHighlighter text={text} />
              </div>
              {/* Actual textarea */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  const newText = e.target.value
                  setText(newText)
                  if (documentState) {
                    updateDocumentContent(newText, 'user')
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
                    e.preventDefault()
                    if (textareaRef.current) {
                      textareaRef.current.select()
                    }
                  }
                }}
                placeholder=""
                className="relative w-full p-12 bg-transparent border-0 resize-none focus:outline-none text-transparent text-base font-light font-sans markdown-editor-textarea caret-gray-900 dark:caret-gray-100"
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
