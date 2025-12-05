/**
 * Agent Context
 *
 * React context for managing the multi-agent editorial system
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { DocumentState } from '../services/agents/documentState'
import { initializeAgentSystem, getAllAgents, getAgentsByStage } from '../agents'
import { getOrchestrator } from '../services/agents/orchestrator'

const AgentContext = createContext()

export function AgentProvider({ children }) {
  const [documentState, setDocumentState] = useState(null)
  const [updateCounter, setUpdateCounter] = useState(0) // Force re-renders
  const [orchestrator] = useState(() => getOrchestrator())
  const [agents, setAgents] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [changeProposals, setChangeProposals] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [executionProgress, setExecutionProgress] = useState(null)

  // Initialize agent system on mount
  useEffect(() => {
    initializeAgentSystem()
    setAgents(getAllAgents())
    setPipelines(orchestrator.getAllPipelines())
  }, [orchestrator])

  /**
   * Initialize or update document state
   */
  const initializeDocument = useCallback((content, metadata = {}) => {
    console.log('[AgentContext] Initializing document', { contentLength: content?.length, metadata })
    const state = new DocumentState(content, metadata)
    setDocumentState(state)
    updateProposalsAndAnnotations(state)
    console.log('[AgentContext] Document initialized successfully')
  }, [])

  /**
   * Update document content
   */
  const updateDocumentContent = useCallback((content, source = 'user') => {
    if (!documentState) return

    documentState.updateContent(content, source)
    setDocumentState(documentState) // Trigger re-render
    updateProposalsAndAnnotations(documentState)
  }, [documentState])

  /**
   * Update proposals and annotations from document state
   */
  const updateProposalsAndAnnotations = useCallback((state) => {
    setChangeProposals(state.getChangeProposals())
    setAnnotations(state.getAnnotations())
  }, [])

  /**
   * Execute a single agent
   */
  const executeAgent = useCallback(async (agentId, options = {}) => {
    console.log('[AgentContext] executeAgent called', { agentId, hasDocumentState: !!documentState })
    if (!documentState) {
      console.error('[AgentContext] No document initialized. DocumentState is null.')
      throw new Error('No document initialized')
    }

    setIsExecuting(true)
    setExecutionProgress({ type: 'agent', agentId, status: 'running' })

    try {
      const result = await orchestrator.executeAgent(agentId, documentState, options)

      // Update proposals and annotations
      updateProposalsAndAnnotations(documentState)

      setExecutionProgress({ type: 'agent', agentId, status: 'completed', result })
      return result
    } catch (error) {
      setExecutionProgress({ type: 'agent', agentId, status: 'failed', error: error.message })
      throw error
    } finally {
      setIsExecuting(false)
      setTimeout(() => setExecutionProgress(null), 3000)
    }
  }, [documentState, orchestrator, updateProposalsAndAnnotations])

  /**
   * Execute a pipeline
   */
  const executePipeline = useCallback(async (pipelineId, options = {}) => {
    if (!documentState) {
      throw new Error('No document initialized')
    }

    setIsExecuting(true)
    setExecutionProgress({ type: 'pipeline', pipelineId, status: 'running' })

    try {
      const result = await orchestrator.executePipeline(pipelineId, documentState, {
        onStepStart: (stepIndex, step) => {
          setCurrentStep({ stepIndex, step, status: 'running' })
        },
        onStepComplete: (stepIndex, step, result) => {
          setCurrentStep({ stepIndex, step, status: 'completed', result })
          updateProposalsAndAnnotations(documentState)
        },
        onProgress: (stepIndex, data) => {
          setExecutionProgress({
            type: 'pipeline',
            pipelineId,
            status: 'running',
            stepIndex,
            data
          })
        },
        ...options
      })

      setExecutionProgress({ type: 'pipeline', pipelineId, status: 'completed', result })
      return result
    } catch (error) {
      setExecutionProgress({ type: 'pipeline', pipelineId, status: 'failed', error: error.message })
      throw error
    } finally {
      setIsExecuting(false)
      setCurrentStep(null)
      setTimeout(() => setExecutionProgress(null), 3000)
    }
  }, [documentState, orchestrator, updateProposalsAndAnnotations])

  /**
   * Approve a change proposal
   */
  const approveProposal = useCallback((proposalId) => {
    if (!documentState) return

    try {
      const newContent = documentState.approveProposal(proposalId)
      // Force React to recognize the state change
      setUpdateCounter(c => c + 1)
      updateProposalsAndAnnotations(documentState)
      return newContent
    } catch (error) {
      console.error('Failed to approve proposal:', error)
      throw error
    }
  }, [documentState, updateProposalsAndAnnotations])

  /**
   * Reject a change proposal
   */
  const rejectProposal = useCallback((proposalId, reason = '') => {
    if (!documentState) return

    try {
      documentState.rejectProposal(proposalId, reason)
      // Force React to recognize the state change
      setUpdateCounter(c => c + 1)
      updateProposalsAndAnnotations(documentState)
    } catch (error) {
      console.error('Failed to reject proposal:', error)
      throw error
    }
  }, [documentState, updateProposalsAndAnnotations])

  /**
   * Approve all proposals from an agent
   */
  const approveAllFromAgent = useCallback((agentId) => {
    if (!documentState) return

    try {
      const results = documentState.approveAllFromAgent(agentId)
      // Force React to recognize the state change
      setUpdateCounter(c => c + 1)
      updateProposalsAndAnnotations(documentState)
      return results
    } catch (error) {
      console.error('Failed to approve all proposals:', error)
      throw error
    }
  }, [documentState, updateProposalsAndAnnotations])

  /**
   * Get pending proposals
   */
  const getPendingProposals = useCallback(() => {
    if (!documentState) return []
    return documentState.getPendingProposals()
  }, [documentState])

  /**
   * Get proposals by filter
   */
  const getFilteredProposals = useCallback((filter) => {
    if (!documentState) return []
    return documentState.getChangeProposals(filter)
  }, [documentState])

  /**
   * Cancel current execution
   */
  const cancelExecution = useCallback(() => {
    orchestrator.cancelCurrentExecution()
    setIsExecuting(false)
    setCurrentStep(null)
    setExecutionProgress(null)
  }, [orchestrator])

  const value = {
    // State
    documentState,
    updateCounter,
    agents,
    pipelines,
    changeProposals,
    annotations,
    isExecuting,
    currentStep,
    executionProgress,

    // Actions
    initializeDocument,
    updateDocumentContent,
    executeAgent,
    executePipeline,
    approveProposal,
    rejectProposal,
    approveAllFromAgent,
    getPendingProposals,
    getFilteredProposals,
    cancelExecution,

    // Utilities
    getAgentsByStage,
    orchestrator
  }

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  )
}

/**
 * Hook to use agent context
 */
export function useAgents() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgents must be used within an AgentProvider')
  }
  return context
}
