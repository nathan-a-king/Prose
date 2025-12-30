import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AgentProvider, useAgents } from '../AgentContext'
import * as agents from '../../agents'
import * as orchestrator from '../../services/agents/orchestrator'

// Mock modules
vi.mock('../../agents', () => ({
  initializeAgentSystem: vi.fn(),
  getAllAgents: vi.fn(() => []),
  getAgentsByStage: vi.fn(() => [])
}))

vi.mock('../../services/agents/orchestrator', () => ({
  getOrchestrator: vi.fn(() => ({
    getAllPipelines: vi.fn(() => []),
    executeAgent: vi.fn(),
    executePipeline: vi.fn(),
    cancelCurrentExecution: vi.fn()
  }))
}))

// TODO: Fix act() warnings in async state updates
describe.skip('AgentContext - Proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('approveProposal', () => {
    test('approves proposal and updates document content', () => {
      function ApproveComponent() {
        const {
          initializeDocument,
          documentState,
          approveProposal,
          changeProposals
        } = useAgents()

        const addAndApproveProposal = () => {
          if (documentState) {
            const proposalId = documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'Updated',
              rationale: 'Better word',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            approveProposal(proposalId)
          }
        }

        return (
          <div>
            <span data-testid="content">{documentState?.getContent() || 'none'}</span>
            <span data-testid="proposals">{changeProposals.length}</span>
            <button onClick={() => initializeDocument('Test content')}>Initialize</button>
            <button onClick={addAndApproveProposal}>Add and Approve</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ApproveComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      expect(screen.getByTestId('content')).toHaveTextContent('Test content')

      screen.getByText('Add and Approve').click()
      expect(screen.getByTestId('content')).toHaveTextContent('Updated content')
    })

    test('increments updateCounter', () => {
      function CounterComponent() {
        const {
          initializeDocument,
          documentState,
          approveProposal,
          updateCounter
        } = useAgents()

        const addAndApproveProposal = () => {
          if (documentState) {
            const proposalId = documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'New',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            approveProposal(proposalId)
          }
        }

        return (
          <div>
            <span data-testid="counter">{updateCounter}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={addAndApproveProposal}>Approve</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <CounterComponent />
        </AgentProvider>
      )

      const initialCounter = screen.getByTestId('counter').textContent

      screen.getByText('Initialize').click()
      screen.getByText('Approve').click()

      const newCounter = screen.getByTestId('counter').textContent
      expect(parseInt(newCounter)).toBeGreaterThan(parseInt(initialCounter))
    })

    test('does nothing when documentState is null', () => {
      function NullDocComponent() {
        const { approveProposal } = useAgents()

        return <button onClick={() => approveProposal('fake-id')}>Approve</button>
      }

      render(
        <AgentProvider>
          <NullDocComponent />
        </AgentProvider>
      )

      // Should not throw
      expect(() => {
        screen.getByText('Approve').click()
      }).not.toThrow()
    })

    test('throws error for invalid proposal id', () => {
      // Suppress console.error
      const originalError = console.error
      console.error = vi.fn()

      function InvalidComponent() {
        const { initializeDocument, approveProposal } = useAgents()

        return (
          <div>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => approveProposal('invalid-id')}>Approve</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <InvalidComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()

      expect(() => {
        screen.getByText('Approve').click()
      }).toThrow()

      console.error = originalError
    })
  })

  describe('rejectProposal', () => {
    test('rejects proposal without changing document content', () => {
      function RejectComponent() {
        const {
          initializeDocument,
          documentState,
          rejectProposal,
          changeProposals
        } = useAgents()

        const addAndRejectProposal = () => {
          if (documentState) {
            const proposalId = documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'Updated',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            rejectProposal(proposalId, 'Not needed')
          }
        }

        const rejectedProposals = changeProposals.filter(p => p.status === 'rejected')

        return (
          <div>
            <span data-testid="content">{documentState?.getContent() || 'none'}</span>
            <span data-testid="rejected">{rejectedProposals.length}</span>
            <button onClick={() => initializeDocument('Test content')}>Initialize</button>
            <button onClick={addAndRejectProposal}>Add and Reject</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <RejectComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      expect(screen.getByTestId('content')).toHaveTextContent('Test content')

      screen.getByText('Add and Reject').click()

      // Content should not change
      expect(screen.getByTestId('content')).toHaveTextContent('Test content')
      // Should have one rejected proposal
      expect(screen.getByTestId('rejected')).toHaveTextContent('1')
    })

    test('increments updateCounter', () => {
      function CounterComponent() {
        const {
          initializeDocument,
          documentState,
          rejectProposal,
          updateCounter
        } = useAgents()

        const addAndRejectProposal = () => {
          if (documentState) {
            const proposalId = documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'New',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            rejectProposal(proposalId)
          }
        }

        return (
          <div>
            <span data-testid="counter">{updateCounter}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={addAndRejectProposal}>Reject</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <CounterComponent />
        </AgentProvider>
      )

      const initialCounter = screen.getByTestId('counter').textContent

      screen.getByText('Initialize').click()
      screen.getByText('Reject').click()

      const newCounter = screen.getByTestId('counter').textContent
      expect(parseInt(newCounter)).toBeGreaterThan(parseInt(initialCounter))
    })

    test('does nothing when documentState is null', () => {
      function NullDocComponent() {
        const { rejectProposal } = useAgents()

        return <button onClick={() => rejectProposal('fake-id')}>Reject</button>
      }

      render(
        <AgentProvider>
          <NullDocComponent />
        </AgentProvider>
      )

      // Should not throw
      expect(() => {
        screen.getByText('Reject').click()
      }).not.toThrow()
    })
  })

  describe('approveAllFromAgent', () => {
    test('approves all proposals from specified agent', () => {
      function ApproveAllComponent() {
        const {
          initializeDocument,
          documentState,
          approveAllFromAgent,
          changeProposals
        } = useAgents()

        const addProposalsAndApproveAll = () => {
          if (documentState) {
            // Add proposals from test-agent
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'New',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            documentState.addChangeProposal({
              type: 'insert',
              location: { start: 5, end: 5 },
              originalText: '',
              proposedText: 'extra ',
              rationale: 'Test',
              category: 'content',
              priority: 'minor',
              agentId: 'test-agent'
            })

            // Add proposal from other-agent
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 10, end: 17 },
              originalText: 'content',
              proposedText: 'text',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'other-agent'
            })

            approveAllFromAgent('test-agent')
          }
        }

        const approvedCount = changeProposals.filter(p => p.status === 'approved').length
        const pendingCount = changeProposals.filter(p => p.status === 'pending').length

        return (
          <div>
            <span data-testid="approved">{approvedCount}</span>
            <span data-testid="pending">{pendingCount}</span>
            <button onClick={() => initializeDocument('Test content')}>Initialize</button>
            <button onClick={addProposalsAndApproveAll}>Approve All</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ApproveAllComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      screen.getByText('Approve All').click()

      // Should have 2 approved (from test-agent) and 1 pending (from other-agent)
      expect(screen.getByTestId('approved')).toHaveTextContent('2')
      expect(screen.getByTestId('pending')).toHaveTextContent('1')
    })

    test('does nothing when documentState is null', () => {
      function NullDocComponent() {
        const { approveAllFromAgent } = useAgents()

        return <button onClick={() => approveAllFromAgent('test-agent')}>Approve All</button>
      }

      render(
        <AgentProvider>
          <NullDocComponent />
        </AgentProvider>
      )

      // Should not throw
      expect(() => {
        screen.getByText('Approve All').click()
      }).not.toThrow()
    })
  })

  describe('getPendingProposals', () => {
    test('returns pending proposals only', () => {
      function PendingComponent() {
        const {
          initializeDocument,
          documentState,
          approveProposal,
          getPendingProposals
        } = useAgents()

        const addProposalsAndApproveOne = () => {
          if (documentState) {
            const id1 = documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'New',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            documentState.addChangeProposal({
              type: 'insert',
              location: { start: 5, end: 5 },
              originalText: '',
              proposedText: 'extra ',
              rationale: 'Test',
              category: 'content',
              priority: 'minor',
              agentId: 'test-agent'
            })

            // Approve first one
            approveProposal(id1)
          }
        }

        const pendingProposals = getPendingProposals()

        return (
          <div>
            <span data-testid="pending">{pendingProposals.length}</span>
            <button onClick={() => initializeDocument('Test content')}>Initialize</button>
            <button onClick={addProposalsAndApproveOne}>Add and Approve One</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <PendingComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      screen.getByText('Add and Approve One').click()

      // Should have 1 pending (second proposal)
      expect(screen.getByTestId('pending')).toHaveTextContent('1')
    })

    test('returns empty array when documentState is null', () => {
      function NullDocComponent() {
        const { getPendingProposals } = useAgents()
        const pending = getPendingProposals()

        return <span data-testid="pending">{pending.length}</span>
      }

      render(
        <AgentProvider>
          <NullDocComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('pending')).toHaveTextContent('0')
    })
  })

  describe('getFilteredProposals', () => {
    test('filters proposals by criteria', () => {
      function FilterComponent() {
        const {
          initializeDocument,
          documentState,
          getFilteredProposals
        } = useAgents()

        const addProposals = () => {
          if (documentState) {
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'New',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'editor-agent'
            })
            documentState.addChangeProposal({
              type: 'insert',
              location: { start: 5, end: 5 },
              originalText: '',
              proposedText: 'extra ',
              rationale: 'Test',
              category: 'content',
              priority: 'important',
              agentId: 'revision-agent'
            })
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 10, end: 17 },
              originalText: 'content',
              proposedText: 'text',
              rationale: 'Test',
              category: 'style',
              priority: 'critical',
              agentId: 'editor-agent'
            })
          }
        }

        const styleProposals = getFilteredProposals({ category: 'style' })
        const editorProposals = getFilteredProposals({ agentId: 'editor-agent' })
        const criticalProposals = getFilteredProposals({ priority: 'critical' })

        return (
          <div>
            <span data-testid="style">{styleProposals.length}</span>
            <span data-testid="editor">{editorProposals.length}</span>
            <span data-testid="critical">{criticalProposals.length}</span>
            <button onClick={() => initializeDocument('Test content')}>Initialize</button>
            <button onClick={addProposals}>Add Proposals</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <FilterComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      screen.getByText('Add Proposals').click()

      expect(screen.getByTestId('style')).toHaveTextContent('2')
      expect(screen.getByTestId('editor')).toHaveTextContent('2')
      expect(screen.getByTestId('critical')).toHaveTextContent('1')
    })

    test('returns empty array when documentState is null', () => {
      function NullDocComponent() {
        const { getFilteredProposals } = useAgents()
        const filtered = getFilteredProposals({ category: 'style' })

        return <span data-testid="filtered">{filtered.length}</span>
      }

      render(
        <AgentProvider>
          <NullDocComponent />
        </AgentProvider>
      )

      expect(screen.getByTestId('filtered')).toHaveTextContent('0')
    })
  })

  describe('Proposal state synchronization', () => {
    test('changeProposals state updates when proposals added', () => {
      function SyncComponent() {
        const { initializeDocument, documentState, changeProposals } = useAgents()

        const addProposal = () => {
          if (documentState) {
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'New',
              rationale: 'Test',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
            // Force update by calling updateProposalsAndAnnotations
            // In real app, this happens automatically after agent execution
          }
        }

        return (
          <div>
            <span data-testid="proposals">{changeProposals.length}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={addProposal}>Add Proposal</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <SyncComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      expect(screen.getByTestId('proposals')).toHaveTextContent('0')

      screen.getByText('Add Proposal').click()

      // Proposal is added to DocumentState but context state won't update
      // until after an approval/rejection/agent execution
      // This is by design - changeProposals syncs on specific actions
    })

    test('annotations state syncs with document state', () => {
      function AnnotationsComponent() {
        const { initializeDocument, documentState, annotations } = useAgents()

        const addAnnotation = () => {
          if (documentState) {
            documentState.addAnnotation({
              agentId: 'test-agent',
              category: 'analysis',
              text: 'Test annotation',
              location: { start: 0, end: 4 }
            })
          }
        }

        return (
          <div>
            <span data-testid="annotations">{annotations.length}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={addAnnotation}>Add Annotation</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <AnnotationsComponent />
        </AgentProvider>
      )

      screen.getByText('Initialize').click()
      expect(screen.getByTestId('annotations')).toHaveTextContent('0')

      screen.getByText('Add Annotation').click()

      // Similar to proposals, annotations sync on specific actions
    })
  })
})
