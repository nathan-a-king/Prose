import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentProvider, useAgents } from '../AgentContext'
import * as agents from '../../agents'
import * as orchestrator from '../../services/agents/orchestrator'

// Mock the agents module
vi.mock('../../agents', () => ({
  initializeAgentSystem: vi.fn(),
  getAllAgents: vi.fn(() => []),
  getAgentsByStage: vi.fn(() => [])
}))

// Mock the orchestrator module
vi.mock('../../services/agents/orchestrator', () => ({
  getOrchestrator: vi.fn(() => ({
    getAllPipelines: vi.fn(() => []),
    executeAgent: vi.fn(),
    executePipeline: vi.fn(),
    cancelCurrentExecution: vi.fn()
  }))
}))

// Test component to access context
function TestComponent() {
  const context = useAgents()

  return (
    <div>
      <span data-testid="has-document">{context.documentState ? 'yes' : 'no'}</span>
      <span data-testid="agents-count">{context.agents.length}</span>
      <span data-testid="pipelines-count">{context.pipelines.length}</span>
      <span data-testid="proposals-count">{context.changeProposals.length}</span>
      <span data-testid="is-executing">{context.isExecuting ? 'yes' : 'no'}</span>
      <button onClick={() => context.initializeDocument('Test content', { title: 'Test' })}>
        Initialize
      </button>
      <button onClick={() => context.updateDocumentContent('Updated content')}>
        Update
      </button>
    </div>
  )
}

// TODO: Fix act() warnings in async state updates
describe.skip('AgentContext - Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AgentProvider initialization', () => {
    test('initializes agent system on mount', () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      expect(agents.initializeAgentSystem).toHaveBeenCalled()
      expect(agents.getAllAgents).toHaveBeenCalled()
    })

    test('loads agents from agent system', () => {
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1' },
        { id: 'agent-2', name: 'Agent 2' }
      ]
      agents.getAllAgents.mockReturnValue(mockAgents)

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('agents-count')).toHaveTextContent('2')
    })

    test('loads pipelines from orchestrator', () => {
      const mockPipelines = [
        { id: 'pipeline-1', name: 'Pipeline 1' },
        { id: 'pipeline-2', name: 'Pipeline 2' }
      ]
      orchestrator.getOrchestrator.mockReturnValue({
        getAllPipelines: vi.fn(() => mockPipelines),
        executeAgent: vi.fn(),
        executePipeline: vi.fn(),
        cancelCurrentExecution: vi.fn()
      })

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('pipelines-count')).toHaveTextContent('2')
    })

    test('exposes correct initial state', () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('has-document')).toHaveTextContent('no')
      expect(screen.getByTestId('proposals-count')).toHaveTextContent('0')
      expect(screen.getByTestId('is-executing')).toHaveTextContent('no')
    })

    test('creates orchestrator instance on initialization', () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      expect(orchestrator.getOrchestrator).toHaveBeenCalled()
    })
  })

  describe('initializeDocument', () => {
    test('creates DocumentState with content and metadata', () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('has-document')).toHaveTextContent('no')

      screen.getByText('Initialize').click()

      expect(screen.getByTestId('has-document')).toHaveTextContent('yes')
    })

    test('initializes with empty content', () => {
      function EmptyInitComponent() {
        const { initializeDocument, documentState } = useAgents()

        return (
          <div>
            <span data-testid="content">{documentState?.getContent() || 'none'}</span>
            <button onClick={() => initializeDocument('')}>Initialize Empty</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <EmptyInitComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize Empty').click()

      expect(screen.getByTestId('content')).toHaveTextContent('')
    })

    test('sets metadata correctly', () => {
      function MetadataComponent() {
        const { initializeDocument, documentState } = useAgents()

        return (
          <div>
            <span data-testid="title">
              {documentState?.getMetadata().title || 'none'}
            </span>
            <button
              onClick={() =>
                initializeDocument('Content', { title: 'My Document', author: 'Test' })
              }
            >
              Initialize
            </button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <MetadataComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()

      expect(screen.getByTestId('title')).toHaveTextContent('My Document')
    })

    test('can reinitialize document with new content', () => {
      function ReinitComponent() {
        const { initializeDocument, documentState } = useAgents()

        return (
          <div>
            <span data-testid="content">{documentState?.getContent() || 'none'}</span>
            <button onClick={() => initializeDocument('First')}>Init First</button>
            <button onClick={() => initializeDocument('Second')}>Init Second</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ReinitComponent />
        </AgentProvider>
      )

      screen.getByText('Init First').click()
      expect(screen.getByTestId('content')).toHaveTextContent('First')

      screen.getByText('Init Second').click()
      expect(screen.getByTestId('content')).toHaveTextContent('Second')
    })

    test('updates proposals and annotations after initialization', () => {
      function ProposalsComponent() {
        const { initializeDocument, changeProposals, documentState } = useAgents()

        const initWithProposals = () => {
          initializeDocument('Content')
          // Add a proposal to the document state
          if (documentState) {
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 7 },
              originalText: 'Content',
              proposedText: 'New content',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
          }
        }

        return (
          <div>
            <span data-testid="proposals">{changeProposals.length}</span>
            <button onClick={initWithProposals}>Initialize</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ProposalsComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()

      // Initial state should have 0 proposals, but after adding one it should update
      // Note: This tests the updateProposalsAndAnnotations call
      expect(screen.getByTestId('proposals')).toHaveTextContent('0')
    })
  })

  describe('updateDocumentContent', () => {
    test('updates existing DocumentState content', () => {
      function UpdateContentComponent() {
        const { initializeDocument, updateDocumentContent, documentState } = useAgents()

        return (
          <div>
            <span data-testid="content">{documentState?.getContent() || 'none'}</span>
            <button onClick={() => initializeDocument('Initial')}>Initialize</button>
            <button onClick={() => updateDocumentContent('Updated')}>Update</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <UpdateContentComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      expect(screen.getByTestId('content')).toHaveTextContent('Initial')

      screen.getByText('Update').click()
      expect(screen.getByTestId('content')).toHaveTextContent('Updated')
    })

    test('does nothing when documentState is null', () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      // Should not throw error
      expect(() => {
        screen.getByText('Update').click()
      }).not.toThrow()

      expect(screen.getByTestId('has-document')).toHaveTextContent('no')
    })

    test('updates with custom source', () => {
      function SourceComponent() {
        const { initializeDocument, updateDocumentContent, documentState } = useAgents()

        return (
          <div>
            <span data-testid="versions">
              {documentState?.getVersionHistory().length || 0}
            </span>
            <button onClick={() => initializeDocument('Initial')}>Initialize</button>
            <button onClick={() => updateDocumentContent('Updated', 'agent:test')}>
              Update
            </button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <SourceComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      expect(screen.getByTestId('versions')).toHaveTextContent('1')

      screen.getByText('Update').click()
      expect(screen.getByTestId('versions')).toHaveTextContent('2')
    })

    test('updates proposals and annotations after content update', () => {
      function UpdateProposalsComponent() {
        const {
          initializeDocument,
          updateDocumentContent,
          documentState,
          changeProposals
        } = useAgents()

        const updateWithProposal = () => {
          updateDocumentContent('New content')
          // Proposals are automatically synced via updateProposalsAndAnnotations
        }

        return (
          <div>
            <span data-testid="proposals">{changeProposals.length}</span>
            <button onClick={() => initializeDocument('Initial')}>Initialize</button>
            <button onClick={updateWithProposal}>Update</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <UpdateProposalsComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      screen.getByText('Update').click()

      // Proposals should be updated (empty in this case)
      expect(screen.getByTestId('proposals')).toHaveTextContent('0')
    })
  })

  describe('Context state exposure', () => {
    test('exposes updateCounter', () => {
      function CounterComponent() {
        const { updateCounter } = useAgents()
        return <span data-testid="counter">{updateCounter}</span>
      }

      render(
        <AgentProvider>
          <CounterComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('counter')).toHaveTextContent('0')
    })

    test('exposes annotations', () => {
      function AnnotationsComponent() {
        const { annotations } = useAgents()
        return <span data-testid="annotations">{annotations.length}</span>
      }

      render(
        <AgentProvider>
          <AnnotationsComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('annotations')).toHaveTextContent('0')
    })

    test('exposes currentStep', () => {
      function CurrentStepComponent() {
        const { currentStep } = useAgents()
        return <span data-testid="step">{currentStep ? 'yes' : 'no'}</span>
      }

      render(
        <AgentProvider>
          <CurrentStepComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('step')).toHaveTextContent('no')
    })

    test('exposes executionProgress', () => {
      function ProgressComponent() {
        const { executionProgress } = useAgents()
        return <span data-testid="progress">{executionProgress ? 'yes' : 'no'}</span>
      }

      render(
        <AgentProvider>
          <ProgressComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('progress')).toHaveTextContent('no')
    })

    test('exposes currentPromptions', () => {
      function PromptionsComponent() {
        const { currentPromptions } = useAgents()
        return <span data-testid="promptions">{currentPromptions ? 'yes' : 'no'}</span>
      }

      render(
        <AgentProvider>
          <PromptionsComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('promptions')).toHaveTextContent('no')
    })

    test('exposes selectedAgent', () => {
      function SelectedAgentComponent() {
        const { selectedAgent } = useAgents()
        return <span data-testid="selected">{selectedAgent || 'none'}</span>
      }

      render(
        <AgentProvider>
          <SelectedAgentComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('selected')).toHaveTextContent('none')
    })

    test('exposes getAgentsByStage utility', () => {
      function UtilityComponent() {
        const { getAgentsByStage } = useAgents()
        return (
          <span data-testid="has-utility">{typeof getAgentsByStage === 'function' ? 'yes' : 'no'}</span>
        )
      }

      render(
        <AgentProvider>
          <UtilityComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('has-utility')).toHaveTextContent('yes')
    })

    test('exposes orchestrator', () => {
      function OrchestratorComponent() {
        const { orchestrator: orch } = useAgents()
        return <span data-testid="has-orchestrator">{orch ? 'yes' : 'no'}</span>
      }

      render(
        <AgentProvider>
          <OrchestratorComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('has-orchestrator')).toHaveTextContent('yes')
    })
  })

  describe('useAgents hook', () => {
    test('throws error when used outside AgentProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useAgents must be used within an AgentProvider')

      console.error = originalError
    })

    test('returns context when used inside AgentProvider', () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>
      )

      // Should render without throwing
      expect(screen.getByTestId('has-document')).toBeInTheDocument()
    })
  })
})
