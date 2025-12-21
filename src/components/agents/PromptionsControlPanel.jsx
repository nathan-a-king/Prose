import { useEffect, useState, useCallback } from 'react'
import { promptionsService } from '../../services/promptions/PromptionsService.js'
import PromptionsOptionsRenderer from './PromptionsOptionsRenderer.jsx'
import PromptionsLoadingState from './PromptionsLoadingState.jsx'

/**
 * PromptionsControlPanel - Main panel component for dynamic option generation
 * Replaces SteerControlBar with LLM-generated, contextually-aware controls
 */
export default function PromptionsControlPanel({ agentId, documentState, onChange }) {
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Generate options when agent selected
  useEffect(() => {
    if (!agentId) {
      setOptions(null)
      setError(null)
      return
    }

    if (!documentState) {
      console.warn('[PromptionsControlPanel] No document state available')
      return
    }

    setLoading(true)
    setError(null)

    promptionsService.getOptionsForAgent(agentId, documentState)
      .then(generatedOptions => {
        setOptions(generatedOptions)
        onChange?.(generatedOptions) // Notify parent
      })
      .catch(err => {
        console.error('[PromptionsControlPanel] Error generating options:', err)
        setError(err)
        // Fallback to empty options
        const empty = promptionsService.basicOptionSet.emptyOptions()
        setOptions(empty)
        onChange?.(empty)
      })
      .finally(() => setLoading(false))
  }, [agentId, documentState, onChange])

  const handleOptionChange = useCallback((updatedOptions) => {
    setOptions(updatedOptions)
    onChange?.(updatedOptions)
  }, [onChange])

  const handleRefresh = useCallback(() => {
    if (!agentId || !documentState) return

    // Regenerate options
    setLoading(true)
    setError(null)
    promptionsService.getOptionsForAgent(agentId, documentState)
      .then(handleOptionChange)
      .catch(err => {
        console.error('[PromptionsControlPanel] Error refreshing options:', err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [agentId, documentState, handleOptionChange])

  // No agent selected
  if (!agentId) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm">Select an agent to configure options</span>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return <PromptionsLoadingState />
  }

  // Error state with retry option
  if (error && (!options || options.isEmpty())) {
    return (
      <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
              Failed to generate options
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              {error.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-800 dark:text-red-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Success state with options renderer
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Configure options for this agent run
        </p>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-neutral-500 text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Options
        </button>
      </div>

      <PromptionsOptionsRenderer
        options={options}
        onChange={handleOptionChange}
      />
    </div>
  )
}
