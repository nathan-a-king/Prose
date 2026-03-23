/**
 * Agent Context
 *
 * React context for managing the multi-agent editorial system.
 * Uses useReducer with immutable document state for correct React updates.
 */

import { createContext, useContext, useState, useEffect, useCallback, useReducer, useRef } from 'react'
import {
  createDocumentState,
  updateContent,
  addChangeProposal as addChangeProposalFn,
  approveProposal as approveProposalFn,
  rejectProposal as rejectProposalFn,
  approveAllFromAgent as approveAllFromAgentFn,
  getChangeProposals,
  getPendingProposals as getPendingProposalsFn,
  getAnnotations,
  DocumentState
} from '../services/agents/documentState'
import { initializeAgentSystem, getAllAgents, getAgentsByStage } from '../agents'
import { getOrchestrator } from '../services/agents/orchestrator'

const AgentContext = createContext()

function documentReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE':
      return createDocumentState(action.content, action.metadata)
    case 'UPDATE_CONTENT':
      return updateContent(state, action.content, action.source)
    case 'APPROVE_PROPOSAL':
      return approveProposalFn(state, action.proposalId)
    case 'REJECT_PROPOSAL':
      return rejectProposalFn(state, action.proposalId, action.reason)
    case 'SYNC':
      return action.state
    default:
      return state
  }
}

export function AgentProvider({ children }) {
  const [docState, dispatch] = useReducer(documentReducer, null)
  const [orchestrator] = useState(() => getOrchestrator())
  const [agents, setAgents] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [executionProgress, setExecutionProgress] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)

  // Ref holding a DocumentState class wrapper for agent execution.
  // Agents call methods on this (addChangeProposal, addAnnotation, etc.)
  // and we sync the internal state back to the reducer after execution.
  const wrapperRef = useRef(null)

  // Keep wrapper in sync when reducer state changes from non-agent actions
  useEffect(() => {
    if (docState && wrapperRef.current) {
      wrapperRef.current._state = docState
    }
  }, [docState])

  // Initialize agent system on mount
  useEffect(() => {
    initializeAgentSystem()
    setAgents(getAllAgents())
    setPipelines(orchestrator.getAllPipelines())
  }, [orchestrator])

  // Derive proposals and annotations from reducer state
  const changeProposals = docState ? getChangeProposals(docState) : []
  const annotations = docState ? getAnnotations(docState) : []

  /**
   * Initialize or update document state
   */
  const initializeDocument = useCallback((content, metadata = {}) => {
    const wrapper = new DocumentState(content, metadata)
    wrapperRef.current = wrapper
    dispatch({ type: 'INITIALIZE', content, metadata })
  }, [])

  /**
   * Update document content
   */
  const updateDocumentContent = useCallback((content, source = 'user') => {
    if (!docState) return
    dispatch({ type: 'UPDATE_CONTENT', content, source })
  }, [docState])

  /**
   * Execute a single agent.
   * Agents use the DocumentState class API (addChangeProposal, etc.),
   * so we pass the wrapper ref and sync its state back afterward.
   */
  const executeAgent = useCallback(async (agentId, options = {}) => {
    if (!docState) {
      console.error('[AgentContext] No document initialized. DocumentState is null.')
      throw new Error('No document initialized')
    }

    setIsExecuting(true)
    setExecutionProgress({ type: 'agent', agentId, status: 'running' })

    try {
      const wrapper = wrapperRef.current
      const result = await orchestrator.executeAgent(agentId, wrapper, options)

      // Sync agent mutations back to reducer
      dispatch({ type: 'SYNC', state: wrapper._state })

      setExecutionProgress({ type: 'agent', agentId, status: 'completed', result })
      return result
    } catch (error) {
      setExecutionProgress({ type: 'agent', agentId, status: 'failed', error: error.message })
      throw error
    } finally {
      setIsExecuting(false)
      setTimeout(() => setExecutionProgress(null), 3000)
    }
  }, [docState, orchestrator])

  /**
   * Execute a pipeline
   */
  const executePipeline = useCallback(async (pipelineId, options = {}) => {
    if (!docState) {
      throw new Error('No document initialized')
    }

    setIsExecuting(true)
    setExecutionProgress({ type: 'pipeline', pipelineId, status: 'running' })

    try {
      const wrapper = wrapperRef.current
      const result = await orchestrator.executePipeline(pipelineId, wrapper, {
        onStepStart: (stepIndex, step) => {
          setCurrentStep({ stepIndex, step, status: 'running' })
        },
        onStepComplete: (stepIndex, step, result) => {
          setCurrentStep({ stepIndex, step, status: 'completed', result })
          // Sync intermediate state so UI updates between pipeline steps
          dispatch({ type: 'SYNC', state: wrapper._state })
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

      // Final sync
      dispatch({ type: 'SYNC', state: wrapper._state })

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
  }, [docState, orchestrator])

  /**
   * Approve a change proposal
   */
  const approveProposal = useCallback((proposalId) => {
    if (!docState) return

    try {
      // Compute new state to get the resulting content
      const newState = approveProposalFn(docState, proposalId)
      dispatch({ type: 'SYNC', state: newState })
      return newState.content
    } catch (error) {
      console.error('Failed to approve proposal:', error)
      throw error
    }
  }, [docState])

  /**
   * Reject a change proposal
   */
  const rejectProposal = useCallback((proposalId, reason = '') => {
    if (!docState) return

    try {
      dispatch({ type: 'REJECT_PROPOSAL', proposalId, reason })
    } catch (error) {
      console.error('Failed to reject proposal:', error)
      throw error
    }
  }, [docState])

  /**
   * Approve all proposals from an agent
   */
  const approveAllFromAgent = useCallback((agentId) => {
    if (!docState) return

    try {
      const { newState, results } = approveAllFromAgentFn(docState, agentId)
      dispatch({ type: 'SYNC', state: newState })
      return results
    } catch (error) {
      console.error('Failed to approve all proposals:', error)
      throw error
    }
  }, [docState])

  /**
   * Get pending proposals
   */
  const getPendingProposals = useCallback(() => {
    if (!docState) return []
    return getPendingProposalsFn(docState)
  }, [docState])

  /**
   * Get proposals by filter
   */
  const getFilteredProposals = useCallback((filter) => {
    if (!docState) return []
    return getChangeProposals(docState, filter)
  }, [docState])

  /**
   * Cancel current execution
   */
  const cancelExecution = useCallback(() => {
    orchestrator.cancelCurrentExecution()
    setIsExecuting(false)
    setCurrentStep(null)
    setExecutionProgress(null)
  }, [orchestrator])

  // Expose the DocumentState wrapper for backward compatibility.
  // Consumers (agents, tests) call methods on this object directly.
  // Will be removed when consumers migrate to dispatch-based API (Phase 2.3).
  const documentState = wrapperRef.current

  const value = {
    // State
    documentState,
    documentContent: docState ? docState.content : null,
    agents,
    pipelines,
    changeProposals,
    annotations,
    isExecuting,
    currentStep,
    executionProgress,
    selectedAgent,

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
    setSelectedAgent,

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
