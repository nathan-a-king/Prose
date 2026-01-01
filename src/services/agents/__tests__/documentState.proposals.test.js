import { describe, test, expect, beforeEach } from 'vitest'
import { DocumentState } from '../documentState'

describe('DocumentState - Proposal Management', () => {
  let docState

  beforeEach(() => {
    docState = new DocumentState('The quick brown fox jumps over the lazy dog', {
      title: 'Test Document'
    })
  })

  describe('addChangeProposal', () => {
    test('adds proposal with unique ID', () => {
      const proposalId = docState.addChangeProposal({
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

      const proposals = docState.getChangeProposals()
      expect(proposals).toHaveLength(1)
      expect(proposals[0].id).toBe(proposalId)
    })

    test('sets status to pending by default', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Indefinite article',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const proposals = docState.getChangeProposals()
      expect(proposals[0].status).toBe('pending')
      expect(proposals[0].createdAt).toBeInstanceOf(Date)
    })

    test('generates unique IDs for multiple proposals', () => {
      const id1 = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      const id2 = docState.addChangeProposal({
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
    beforeEach(() => {
      docState.addChangeProposal({
        type: 'replace',
        agentId: 'editor-agent',
        category: 'style',
        priority: 'minor',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test'
      })

      docState.addChangeProposal({
        type: 'insert',
        agentId: 'revision-agent',
        category: 'content',
        priority: 'important',
        location: { start: 10, end: 10 },
        originalText: '',
        proposedText: 'very ',
        rationale: 'Test'
      })

      docState.addChangeProposal({
        type: 'replace',
        agentId: 'editor-agent',
        category: 'grammar',
        priority: 'critical',
        location: { start: 16, end: 19 },
        originalText: 'fox',
        proposedText: 'cat',
        rationale: 'Test'
      })
    })

    test('returns all proposals when no filter', () => {
      const proposals = docState.getChangeProposals()
      expect(proposals).toHaveLength(3)
    })

    test('filters by status', () => {
      const proposals = docState.getChangeProposals({ status: 'pending' })
      expect(proposals).toHaveLength(3)
      expect(proposals.every(p => p.status === 'pending')).toBe(true)
    })

    test('filters by agentId', () => {
      const proposals = docState.getChangeProposals({ agentId: 'editor-agent' })
      expect(proposals).toHaveLength(2)
      expect(proposals.every(p => p.agentId === 'editor-agent')).toBe(true)
    })

    test('filters by category', () => {
      const proposals = docState.getChangeProposals({ category: 'style' })
      expect(proposals).toHaveLength(1)
      expect(proposals[0].category).toBe('style')
    })

    test('filters by priority', () => {
      const proposals = docState.getChangeProposals({ priority: 'important' })
      expect(proposals).toHaveLength(1)
      expect(proposals[0].priority).toBe('important')
    })

    test('combines multiple filters', () => {
      const proposals = docState.getChangeProposals({
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
      const id1 = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      const id2 = docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      // Approve one proposal
      docState.approveProposal(id1)

      const pendingProposals = docState.getPendingProposals()
      expect(pendingProposals).toHaveLength(1)
      expect(pendingProposals[0].id).toBe(id2)
    })
  })

  describe('approveProposal', () => {
    test('applies replace change using text matching', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Simpler word',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const newContent = docState.approveProposal(proposalId)

      expect(newContent).toBe('The fast brown fox jumps over the lazy dog')
      expect(docState.getContent()).toBe('The fast brown fox jumps over the lazy dog')
    })

    test('updates proposal status to approved', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      docState.approveProposal(proposalId)

      const proposals = docState.getChangeProposals()
      const approvedProposal = proposals.find(p => p.id === proposalId)

      expect(approvedProposal.status).toBe('approved')
      expect(approvedProposal.appliedAt).toBeInstanceOf(Date)
    })

    test('creates version history entry with agent source', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const versionsBefore = docState.getVersionHistory().length
      docState.approveProposal(proposalId)
      const versionsAfter = docState.getVersionHistory().length

      expect(versionsAfter).toBe(versionsBefore + 1)

      const latestVersion = docState.getVersionHistory()[versionsAfter - 1]
      expect(latestVersion.source).toBe('agent:editor-agent')
    })

    test('tracks applied changes', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      docState.approveProposal(proposalId)

      const exported = docState.export()
      expect(exported.appliedChanges).toHaveLength(1)
      expect(exported.appliedChanges[0].proposalId).toBe(proposalId)
      expect(exported.appliedChanges[0].timestamp).toBeInstanceOf(Date)
    })

    test('throws error when proposal not found', () => {
      expect(() => {
        docState.approveProposal('non-existent-id')
      }).toThrow('Proposal non-existent-id not found')
    })

    test('throws error when proposal not pending', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      docState.approveProposal(proposalId)

      expect(() => {
        docState.approveProposal(proposalId)
      }).toThrow(`Proposal ${proposalId} is not pending`)
    })

    test('marks other pending proposals as potentially invalid', () => {
      const id1 = docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'agent-1'
      })

      const id2 = docState.addChangeProposal({
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
      docState.approveProposal(id1)

      const proposals = docState.getChangeProposals()
      const secondProposal = proposals.find(p => p.id === id2)

      expect(secondProposal.status).toBe('pending')
      expect(secondProposal.metadata?.mayBeInvalid).toBe(true)
    })
  })

  describe('rejectProposal', () => {
    test('updates proposal status to rejected', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const proposal = docState.rejectProposal(proposalId, 'Not needed')

      expect(proposal.status).toBe('rejected')
      expect(proposal.rejectedAt).toBeInstanceOf(Date)
      expect(proposal.rejectionReason).toBe('Not needed')
    })

    test('does not change document content', () => {
      const originalContent = docState.getContent()

      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      docState.rejectProposal(proposalId)

      expect(docState.getContent()).toBe(originalContent)
    })

    test('throws error when proposal not found', () => {
      expect(() => {
        docState.rejectProposal('non-existent-id')
      }).toThrow('Proposal non-existent-id not found')
    })

    test('allows rejection with empty reason', () => {
      const proposalId = docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 3 },
        originalText: 'The',
        proposedText: 'A',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      const proposal = docState.rejectProposal(proposalId)

      expect(proposal.status).toBe('rejected')
      expect(proposal.rejectionReason).toBe('')
    })
  })

  describe('approveAllFromAgent', () => {
    beforeEach(() => {
      docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      docState.addChangeProposal({
        type: 'replace',
        location: { start: 16, end: 19 },
        originalText: 'fox',
        proposedText: 'cat',
        rationale: 'Test',
        category: 'content',
        priority: 'minor',
        agentId: 'editor-agent'
      })

      docState.addChangeProposal({
        type: 'replace',
        location: { start: 35, end: 39 },
        originalText: 'lazy',
        proposedText: 'sleepy',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'revision-agent'
      })
    })

    test('approves all proposals from specified agent', () => {
      const results = docState.approveAllFromAgent('editor-agent')

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)

      const editorProposals = docState.getChangeProposals({ agentId: 'editor-agent' })
      expect(editorProposals.every(p => p.status === 'approved')).toBe(true)
    })

    test('does not approve proposals from other agents', () => {
      docState.approveAllFromAgent('editor-agent')

      const revisionProposals = docState.getChangeProposals({ agentId: 'revision-agent' })
      expect(revisionProposals[0].status).toBe('pending')
    })

    test('returns all results for multiple proposals', () => {
      // Add multiple proposals from same agent
      docState.addChangeProposal({
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'batch-agent'
      })

      docState.addChangeProposal({
        type: 'replace',
        location: { start: 10, end: 15 },
        originalText: 'brown',
        proposedText: 'red',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'batch-agent'
      })

      const results = docState.approveAllFromAgent('batch-agent')

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
      expect(results.every(r => r.proposalId)).toBeTruthy()
    })

    test('handles agent with no proposals', () => {
      const results = docState.approveAllFromAgent('non-existent-agent')

      expect(results).toHaveLength(0)
    })
  })

  describe('applyChange', () => {
    test('handles replace operation with text matching', () => {
      const proposal = {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'quick',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      }

      const newContent = docState.applyChange(proposal)

      expect(newContent).toBe('The fast brown fox jumps over the lazy dog')
    })

    test('handles replace operation with position fallback', () => {
      const proposal = {
        type: 'replace',
        location: { start: 4, end: 9 },
        originalText: 'NONEXISTENT',
        proposedText: 'fast',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      }

      const newContent = docState.applyChange(proposal)

      // Falls back to position-based replacement
      expect(newContent).toBe('The fast brown fox jumps over the lazy dog')
    })

    test('handles insert operation', () => {
      const proposal = {
        type: 'insert',
        location: { start: 10, end: 10 },
        originalText: '',
        proposedText: 'very ',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      }

      const newContent = docState.applyChange(proposal)

      expect(newContent).toBe('The quick very brown fox jumps over the lazy dog')
    })

    test('handles delete operation', () => {
      const proposal = {
        type: 'delete',
        location: { start: 4, end: 10 },
        originalText: 'quick ',
        proposedText: '',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'editor-agent'
      }

      const newContent = docState.applyChange(proposal)

      expect(newContent).toBe('The brown fox jumps over the lazy dog')
    })

    test('handles restructure operation', () => {
      const proposal = {
        type: 'restructure',
        location: { start: 0, end: 44 },
        originalText: 'The quick brown fox jumps over the lazy dog',
        proposedText: 'A lazy dog was jumped over by a quick brown fox',
        rationale: 'Test',
        category: 'structure',
        priority: 'major',
        agentId: 'editor-agent'
      }

      const newContent = docState.applyChange(proposal)

      expect(newContent).toBe('A lazy dog was jumped over by a quick brown fox')
    })

    test('handles comment operation without changing content', () => {
      const proposal = {
        type: 'comment',
        location: { start: 0, end: 0 },
        originalText: '',
        proposedText: 'This is a comment',
        rationale: 'Test',
        category: 'comment',
        priority: 'minor',
        agentId: 'editor-agent'
      }

      const newContent = docState.applyChange(proposal)

      expect(newContent).toBe('The quick brown fox jumps over the lazy dog')
    })

    test('throws error on unknown change type', () => {
      const proposal = {
        type: 'unknown',
        location: { start: 0, end: 0 },
        originalText: '',
        proposedText: 'test',
        rationale: 'Test',
        category: 'test',
        priority: 'minor',
        agentId: 'editor-agent'
      }

      expect(() => {
        docState.applyChange(proposal)
      }).toThrow('Unknown change type: unknown')
    })
  })
})
