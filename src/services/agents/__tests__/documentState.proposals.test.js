import { describe, test, expect, beforeEach } from 'vitest'
import {
  createDocumentState,
  addChangeProposal,
  getChangeProposals,
  getPendingProposals,
  approveProposal,
  rejectProposal,
  approveAllFromAgent,
  applyChange,
  exportState
} from '../documentState'

describe('DocumentState - Proposal Management (Pure Functions)', () => {
  let state

  beforeEach(() => {
    state = createDocumentState('The quick brown fox jumps over the lazy dog', {
      title: 'Test Document'
    })
  })

  describe('addChangeProposal', () => {
    test('adds proposal with unique ID', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Simpler word',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      expect(proposalId).toBeTruthy()
      expect(proposalId).toMatch(/^proposal-/)

      const proposals = getChangeProposals(newState)
      expect(proposals).toHaveLength(1)
      expect(proposals[0].id).toBe(proposalId)
    })

    test('does not mutate original state', () => {
      addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      expect(getChangeProposals(state)).toHaveLength(0)
    })

    test('sets status to pending by default', () => {
      const { newState } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Indefinite article',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const proposals = getChangeProposals(newState)
      expect(proposals[0].status).toBe('pending')
      expect(proposals[0].createdAt).toBeInstanceOf(Date)
    })

    test('generates unique IDs for multiple proposals', () => {
      const { newState: state1, proposalId: id1 } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      const { proposalId: id2 } = addChangeProposal(state1, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      expect(id1).not.toBe(id2)
    })
  })

  describe('getChangeProposals', () => {
    let stateWithProposals

    beforeEach(() => {
      let current = state
      current = addChangeProposal(current, {
        type: 'replace',
        agentId: 'editor-agent',
        category: 'style',
        priority: 'minor',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test'
      }).newState

      current = addChangeProposal(current, {
        type: 'insert',
        agentId: 'revision-agent',
        category: 'content',
        priority: 'important',
        location: { start: 10, end: 10 },
        originalText: '',
        proposedText: 'very ',
        rationale: 'Test'
      }).newState

      current = addChangeProposal(current, {
        type: 'replace',
        agentId: 'editor-agent',
        category: 'grammar',
        priority: 'critical',
        location: { start: 16, end: 19 },
        originalText: 'fox',
        proposedText: 'cat',
        rationale: 'Test'
      }).newState

      stateWithProposals = current
    })

    test('returns all proposals when no filter', () => {
      const proposals = getChangeProposals(stateWithProposals)
      expect(proposals).toHaveLength(3)
    })

    test('filters by status', () => {
      const proposals = getChangeProposals(stateWithProposals, { status: 'pending' })
      expect(proposals).toHaveLength(3)
      expect(proposals.every(p => p.status === 'pending')).toBe(true)
    })

    test('filters by agentId', () => {
      const proposals = getChangeProposals(stateWithProposals, { agentId: 'editor-agent' })
      expect(proposals).toHaveLength(2)
      expect(proposals.every(p => p.agentId === 'editor-agent')).toBe(true)
    })

    test('filters by category', () => {
      const proposals = getChangeProposals(stateWithProposals, { category: 'style' })
      expect(proposals).toHaveLength(1)
      expect(proposals[0].category).toBe('style')
    })

    test('filters by priority', () => {
      const proposals = getChangeProposals(stateWithProposals, { priority: 'important' })
      expect(proposals).toHaveLength(1)
      expect(proposals[0].priority).toBe('important')
    })

    test('combines multiple filters', () => {
      const proposals = getChangeProposals(stateWithProposals, {
        agentId: 'editor-agent',
        category: 'style'
      })
      expect(proposals).toHaveLength(1)
      expect(proposals[0].agentId).toBe('editor-agent')
      expect(proposals[0].category).toBe('style')
    })
  })

  describe('getPendingProposals', () => {
    test('returns only pending proposals', () => {
      let current = state
      const { newState: s1 } = addChangeProposal(current, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      const { newState: s2, proposalId: id2 } = addChangeProposal(s1, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      // Approve first proposal
      const id1 = getChangeProposals(s2)[0].id
      const afterApprove = approveProposal(s2, id1)

      const pendingProposals = getPendingProposals(afterApprove)
      expect(pendingProposals).toHaveLength(1)
      expect(pendingProposals[0].id).toBe(id2)
    })
  })

  describe('approveProposal', () => {
    test('applies replace change using text matching', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Simpler word',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterApprove = approveProposal(newState, proposalId)

      expect(afterApprove.content).toBe('The fast brown fox jumps over the lazy dog')
    })

    test('does not mutate original state', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      approveProposal(newState, proposalId)

      expect(newState.content).toBe('The quick brown fox jumps over the lazy dog')
    })

    test('updates proposal status to approved', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterApprove = approveProposal(newState, proposalId)
      const approvedProposal = getChangeProposals(afterApprove).find(p => p.id === proposalId)

      expect(approvedProposal.status).toBe('approved')
      expect(approvedProposal.appliedAt).toBeInstanceOf(Date)
    })

    test('creates version history entry with agent source', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const versionsBefore = newState.versions.length
      const afterApprove = approveProposal(newState, proposalId)

      expect(afterApprove.versions.length).toBe(versionsBefore + 1)
      const latestVersion = afterApprove.versions[afterApprove.versions.length - 1]
      expect(latestVersion.source).toBe('agent:editor-agent')
    })

    test('tracks applied changes', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterApprove = approveProposal(newState, proposalId)
      const exported = exportState(afterApprove)

      expect(exported.appliedChanges).toHaveLength(1)
      expect(exported.appliedChanges[0].proposalId).toBe(proposalId)
      expect(exported.appliedChanges[0].timestamp).toBeInstanceOf(Date)
    })

    test('throws error when proposal not found', () => {
      expect(() => {
        approveProposal(state, 'non-existent-id')
      }).toThrow('Proposal non-existent-id not found')
    })

    test('throws error when proposal not pending', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterApprove = approveProposal(newState, proposalId)

      expect(() => {
        approveProposal(afterApprove, proposalId)
      }).toThrow(`Proposal ${proposalId} is not pending`)
    })

    test('marks other pending proposals as potentially invalid', () => {
      let current = state
      const { newState: s1, proposalId: id1 } = addChangeProposal(current, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      const { newState: s2, proposalId: id2 } = addChangeProposal(s1, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'speedy',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-2'
      })

      // Approve first proposal - should mark second as invalid
      const afterApprove = approveProposal(s2, id1)

      const secondProposal = getChangeProposals(afterApprove).find(p => p.id === id2)
      expect(secondProposal.status).toBe('pending')
      expect(secondProposal.metadata?.mayBeInvalid).toBe(true)
    })
  })

  describe('rejectProposal', () => {
    test('updates proposal status to rejected', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterReject = rejectProposal(newState, proposalId, 'Not needed')
      const rejectedProposal = getChangeProposals(afterReject).find(p => p.id === proposalId)

      expect(rejectedProposal.status).toBe('rejected')
      expect(rejectedProposal.rejectedAt).toBeInstanceOf(Date)
      expect(rejectedProposal.rejectionReason).toBe('Not needed')
    })

    test('does not change document content', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterReject = rejectProposal(newState, proposalId)
      expect(afterReject.content).toBe(state.content)
    })

    test('throws error when proposal not found', () => {
      expect(() => {
        rejectProposal(state, 'non-existent-id')
      }).toThrow('Proposal non-existent-id not found')
    })

    test('allows rejection with empty reason', () => {
      const { newState, proposalId } = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const afterReject = rejectProposal(newState, proposalId)
      const proposal = getChangeProposals(afterReject).find(p => p.id === proposalId)

      expect(proposal.status).toBe('rejected')
      expect(proposal.rejectionReason).toBe('')
    })
  })

  describe('approveAllFromAgent', () => {
    let stateWithProposals

    beforeEach(() => {
      let current = state
      current = addChangeProposal(current, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      }).newState

      current = addChangeProposal(current, {
        type: 'replace',
        location: { start: 16, end: 19 },
        originalText: 'fox',
        proposedText: 'cat',
        rationale: 'Test',
        category: 'content',
        priority: 'minor',
        agentId: 'editor-agent'
      }).newState

      current = addChangeProposal(current, {
        type: 'replace',
        location: { start: 35, end: 39 },
        originalText: 'lazy',
        proposedText: 'sleepy',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'revision-agent'
      }).newState

      stateWithProposals = current
    })

    test('approves all proposals from specified agent', () => {
      const { newState, results } = approveAllFromAgent(stateWithProposals, 'editor-agent')

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)

      const editorProposals = getChangeProposals(newState, { agentId: 'editor-agent' })
      expect(editorProposals.every(p => p.status === 'approved')).toBe(true)
    })

    test('does not approve proposals from other agents', () => {
      const { newState } = approveAllFromAgent(stateWithProposals, 'editor-agent')

      const revisionProposals = getChangeProposals(newState, { agentId: 'revision-agent' })
      expect(revisionProposals[0].status).toBe('pending')
    })

    test('handles agent with no proposals', () => {
      const { results } = approveAllFromAgent(stateWithProposals, 'non-existent-agent')
      expect(results).toHaveLength(0)
    })
  })

  describe('applyChange', () => {
    const content = 'The quick brown fox jumps over the lazy dog'

    test('handles replace operation with text matching', () => {
      const newContent = applyChange(content, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast'
      })

      expect(newContent).toBe('The fast brown fox jumps over the lazy dog')
    })

    test('handles replace operation with position fallback', () => {
      const newContent = applyChange(content, {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'NONEXISTENT',
        proposedText: 'fast'
      })

      // Falls back to position-based replacement
      expect(newContent).toBe('The fast brown fox jumps over the lazy dog')
    })

    test('handles insert operation', () => {
      const newContent = applyChange(content, {
        type: 'insert',
        location: { start: 10, end: 10 },
        originalText: '',
        proposedText: 'very '
      })

      expect(newContent).toBe('The quick very brown fox jumps over the lazy dog')
    })

    test('handles delete operation', () => {
      const newContent = applyChange(content, {
        type: 'delete',
        location: { start: 4, end: 10 },
        originalText: 'quick ',
        proposedText: ''
      })

      expect(newContent).toBe('The brown fox jumps over the lazy dog')
    })

    test('handles restructure operation', () => {
      const newContent = applyChange(content, {
        type: 'restructure',
        location: { start: 0, end: 44 },
        originalText: content,
        proposedText: 'A lazy dog was jumped over by a quick brown fox'
      })

      expect(newContent).toBe('A lazy dog was jumped over by a quick brown fox')
    })

    test('handles comment operation without changing content', () => {
      const newContent = applyChange(content, {
        type: 'comment',
        location: { start: 0, end: 0 },
        originalText: '',
        proposedText: 'This is a comment'
      })

      expect(newContent).toBe(content)
    })

    test('throws error on unknown change type', () => {
      expect(() => {
        applyChange(content, {
          type: 'unknown',
          location: { start: 0, end: 0 },
          originalText: '',
          proposedText: 'test'
        })
      }).toThrow('Unknown change type: unknown')
    })
  })
})
