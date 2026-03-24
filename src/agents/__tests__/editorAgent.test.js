import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DocumentState } from '../../services/agents/documentState'

vi.mock('../../services/agents/aiService', () => ({
  makeCompletion: vi.fn()
}))

import { makeCompletion } from '../../services/agents/aiService'
import { editorAgentContract, EDITOR_AGENT_ID } from '../editorAgent'

describe('editorAgent', () => {
  let documentState

  beforeEach(() => {
    documentState = new DocumentState('It is important to note that the end result was achieved.', {
      title: 'Draft Article'
    })
    vi.clearAllMocks()
  })

  describe('contract', () => {
    test('has correct id and stage', () => {
      expect(editorAgentContract.id).toBe('editor-agent')
      expect(editorAgentContract.stage).toBe('edit')
    })

    test('uses low temperature for precision', () => {
      expect(editorAgentContract.config.temperature).toBe(0.3)
    })
  })

  describe('execute', () => {
    test('returns error for empty content', async () => {
      const emptyDoc = new DocumentState('')

      const result = await editorAgentContract.execute(emptyDoc)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content to edit')
      expect(makeCompletion).not.toHaveBeenCalled()
    })

    test('creates proposals from edits', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Several filler phrases found',
        improvements: { clarity: [], concision: ['Remove filler'], style: [] },
        patterns: ['Filler phrases'],
        edits: [
          {
            location: { start: 0, end: 30 },
            before: 'It is important to note that',
            after: 'Note:',
            reason: 'Filler phrase',
            type: 'concision',
            priority: 'important'
          },
          {
            location: { start: 35, end: 45 },
            before: 'end result',
            after: 'result',
            reason: 'Redundancy',
            type: 'concision',
            priority: 'minor'
          }
        ]
      })

      const result = await editorAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(2)

      const proposals = documentState.getPendingProposals()
      expect(proposals).toHaveLength(2)
      expect(proposals[0].type).toBe('replace')
      expect(proposals[0].agentId).toBe(EDITOR_AGENT_ID)
    })

    test('maps all edit types to STYLE category', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        edits: [
          { location: { start: 0, end: 5 }, after: 'a', type: 'clarity', priority: 'minor' },
          { location: { start: 5, end: 10 }, after: 'b', type: 'concision', priority: 'minor' },
          { location: { start: 10, end: 15 }, after: 'c', type: 'style', priority: 'minor' }
        ]
      })

      await editorAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      proposals.forEach(p => {
        expect(p.category).toBe('style')
      })
    })

    test('maps priority correctly', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        edits: [
          { location: { start: 0, end: 5 }, after: 'a', type: 'style', priority: 'critical' },
          { location: { start: 5, end: 10 }, after: 'b', type: 'style', priority: 'important' },
          { location: { start: 10, end: 15 }, after: 'c', type: 'style', priority: 'minor' }
        ]
      })

      await editorAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].priority).toBe('critical')
      expect(proposals[1].priority).toBe('important')
      expect(proposals[2].priority).toBe('minor')
    })

    test('skips edits without required fields', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        edits: [
          { location: { start: 0, end: 5 }, after: 'valid', type: 'style', priority: 'minor' },
          { after: 'no location' },
          { location: { start: 5, end: 10 } } // no after
        ]
      })

      await editorAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals).toHaveLength(1)
    })

    test('stores editType in proposal metadata', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        edits: [
          { location: { start: 0, end: 5 }, after: 'new', type: 'clarity', priority: 'minor' }
        ]
      })

      await editorAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].metadata.editType).toBe('clarity')
    })

    test('adds annotation with improvements and patterns', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Good prose overall',
        improvements: { clarity: ['Better'], concision: [], style: [] },
        patterns: ['Passive voice'],
        edits: []
      })

      await editorAgentContract.execute(documentState)

      const annotations = documentState.getAnnotations()
      expect(annotations).toHaveLength(1)
      expect(annotations[0].agentId).toBe(EDITOR_AGENT_ID)
      expect(annotations[0].data.patterns).toContain('Passive voice')
    })

    test('passes focus option to system prompt', async () => {
      makeCompletion.mockResolvedValue({ summary: 'Test', edits: [] })

      await editorAgentContract.execute(documentState, { focus: 'concision' })

      const call = makeCompletion.mock.calls[0][0]
      expect(call.systemPrompt).toContain('concision')
    })

    test('handles invalid response format', async () => {
      makeCompletion.mockResolvedValue({ noEdits: true })

      const result = await editorAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(0)
    })

    test('handles AI service error', async () => {
      makeCompletion.mockRejectedValue(new Error('Invalid API key'))

      const result = await editorAgentContract.execute(documentState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })
  })
})
