/**
 * Agent Context — Split into Execution and Proposal concerns
 *
 * AgentExecutionContext: for components that run agents
 * DocumentProposalContext: for components that display/act on results
 *
 * useAgents() is a combined hook for backward compatibility.
 */

import { createContext, useContext, useState, useEffect, useCallback, useReducer, useRef } from 'react'
import {
  createDocumentState,
  updateContent,
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

const AgentExecutionContext = createContext()
const DocumentProposalContext = createContext()

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
    case 'APPROVE_ALL_FROM_AGENT':
      return approveAllFromAgentFn(state, action.agentId).newState
    case 'MERGE_AGENT_RESULTS': {
      return {
        ...state,
        changeProposals: [...state.changeProposals, ...action.newProposals],
        annotations: [...state.annotations, ...action.newAnnotations]
      }
    }
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

  // Ref holding a DocumentState class wrapper for agent execution
  const wrapperRef = useRef(null)

  // Keep wrapper in sync when reducer state changes from non-agent actions
  useEffect(() => {
    if (docState && wrapperRef.current) {
      wrapperRef.current.setState(docState)
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

  const initializeDocument = useCallback((content, metadata = {}) => {
    const wrapper = new DocumentState(content, metadata)
    wrapperRef.current = wrapper
    dispatch({ type: 'INITIALIZE', content, metadata })
  }, [])

  const updateDocumentContent = useCallback((content, source = 'user') => {
    if (!docState) return
    dispatch({ type: 'UPDATE_CONTENT', content, source })
  }, [docState])

  const executeAgent = useCallback(async (agentId, options = {}) => {
    if (!docState) {
      console.error('[AgentContext] No document initialized. DocumentState is null.')
      throw new Error('No document initialized')
    }

    setIsExecuting(true)
    setExecutionProgress({ type: 'agent', agentId, status: 'running' })

    try {
      const wrapper = wrapperRef.current
      const existingProposalIds = new Set(docState.changeProposals.map(p => p.id))
      const existingAnnotationIds = new Set(docState.annotations.map(a => a.id))

      const result = await orchestrator.executeAgent(agentId, wrapper, options)

      const wrapperState = wrapper.getState()
      const newProposals = wrapperState.changeProposals.filter(p => !existingProposalIds.has(p.id))
      const newAnnotations = wrapperState.annotations.filter(a => !existingAnnotationIds.has(a.id))
      dispatch({ type: 'MERGE_AGENT_RESULTS', newProposals, newAnnotations })

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

  const executePipeline = useCallback(async (pipelineId, options = {}) => {
    if (!docState) {
      throw new Error('No document initialized')
    }

    setIsExecuting(true)
    setExecutionProgress({ type: 'pipeline', pipelineId, status: 'running' })

    try {
      const wrapper = wrapperRef.current
      const existingProposalIds = new Set(docState.changeProposals.map(p => p.id))
      const existingAnnotationIds = new Set(docState.annotations.map(a => a.id))

      const result = await orchestrator.executePipeline(pipelineId, wrapper, {
        onStepStart: (stepIndex, step) => {
          setCurrentStep({ stepIndex, step, status: 'running' })
        },
        onStepComplete: (stepIndex, step, stepResult) => {
          setCurrentStep({ stepIndex, step, status: 'completed', result: stepResult })
          // Merge intermediate results
          const wrapperState = wrapper.getState()
          const newProposals = wrapperState.changeProposals.filter(p => !existingProposalIds.has(p.id))
          const newAnnotations = wrapperState.annotations.filter(a => !existingAnnotationIds.has(a.id))
          dispatch({ type: 'MERGE_AGENT_RESULTS', newProposals, newAnnotations })
          // Track newly merged IDs for subsequent steps
          newProposals.forEach(p => existingProposalIds.add(p.id))
          newAnnotations.forEach(a => existingAnnotationIds.add(a.id))
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

      // Final merge for any proposals added after last onStepComplete
      const wrapperState = wrapper.getState()
      const finalNewProposals = wrapperState.changeProposals.filter(p => !existingProposalIds.has(p.id))
      const finalNewAnnotations = wrapperState.annotations.filter(a => !existingAnnotationIds.has(a.id))
      if (finalNewProposals.length > 0 || finalNewAnnotations.length > 0) {
        dispatch({ type: 'MERGE_AGENT_RESULTS', newProposals: finalNewProposals, newAnnotations: finalNewAnnotations })
      }

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

  const approveProposal = useCallback((proposalId) => {
    if (!docState) return
    try {
      dispatch({ type: 'APPROVE_PROPOSAL', proposalId })
      const newState = approveProposalFn(docState, proposalId)
      return newState.content
    } catch (error) {
      console.error('Failed to approve proposal:', error)
      throw error
    }
  }, [docState])

  const rejectProposal = useCallback((proposalId, reason = '') => {
    if (!docState) return
    try {
      dispatch({ type: 'REJECT_PROPOSAL', proposalId, reason })
    } catch (error) {
      console.error('Failed to reject proposal:', error)
      throw error
    }
  }, [docState])

  const approveAllFromAgent = useCallback((agentId) => {
    if (!docState) return
    try {
      const { results } = approveAllFromAgentFn(docState, agentId)
      dispatch({ type: 'APPROVE_ALL_FROM_AGENT', agentId })
      return results
    } catch (error) {
      console.error('Failed to approve all proposals:', error)
      throw error
    }
  }, [docState])

  const getPendingProposals = useCallback(() => {
    if (!docState) return []
    return getPendingProposalsFn(docState)
  }, [docState])

  const getFilteredProposals = useCallback((filter) => {
    if (!docState) return []
    return getChangeProposals(docState, filter)
  }, [docState])

  const cancelExecution = useCallback(() => {
    orchestrator.cancelCurrentExecution()
    setIsExecuting(false)
    setCurrentStep(null)
    setExecutionProgress(null)
  }, [orchestrator])

  const documentState = wrapperRef.current

  const executionValue = {
    agents,
    pipelines,
    executeAgent,
    executePipeline,
    cancelExecution,
    isExecuting,
    currentStep,
    executionProgress,
    selectedAgent,
    setSelectedAgent,
    orchestrator
  }

  const proposalValue = {
    documentState,
    documentContent: docState ? docState.content : null,
    changeProposals,
    annotations,
    initializeDocument,
    updateDocumentContent,
    approveProposal,
    rejectProposal,
    approveAllFromAgent,
    getPendingProposals,
    getFilteredProposals,
    getAgentsByStage
  }

  return (
    <AgentExecutionContext.Provider value={executionValue}>
      <DocumentProposalContext.Provider value={proposalValue}>
        {children}
      </DocumentProposalContext.Provider>
    </AgentExecutionContext.Provider>
  )
}

/**
 * Hook for agent execution concerns (running agents, pipelines, progress)
 */
export function useAgentExecution() {
  const context = useContext(AgentExecutionContext)
  if (!context) {
    throw new Error('useAgentExecution must be used within an AgentProvider')
  }
  return context
}

/**
 * Hook for document proposal concerns (proposals, annotations, document state)
 */
export function useDocumentProposals() {
  const context = useContext(DocumentProposalContext)
  if (!context) {
    throw new Error('useDocumentProposals must be used within an AgentProvider')
  }
  return context
}

/**
 * Combined hook for backward compatibility.
 * Components that need both contexts can use this, but prefer the
 * specific hooks to avoid unnecessary re-renders.
 */
export function useAgents() {
  const execution = useContext(AgentExecutionContext)
  const proposals = useContext(DocumentProposalContext)
  if (!execution || !proposals) {
    throw new Error('useAgents must be used within an AgentProvider')
  }
  return { ...execution, ...proposals }
}
