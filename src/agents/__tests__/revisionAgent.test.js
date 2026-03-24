import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DocumentState } from '../../services/agents/documentState'

vi.mock('../../services/agents/aiService', () => ({
  makeCompletion: vi.fn()
}))

import { makeCompletion } from '../../services/agents/aiService'
import { revisionAgentContract, REVISION_AGENT_ID } from '../revisionAgent'

describe('revisionAgent', () => {
  let documentState

  beforeEach(() => {
    documentState = new DocumentState('The technology is very important and it has many uses.', {
      title: 'Tech Article'
    })
    vi.clearAllMocks()
  })

  describe('contract', () => {
    test('has correct id and stage', () => {
      expect(revisionAgentContract.id).toBe('revision-agent')
      expect(revisionAgentContract.stage).toBe('revise')
    })

    test('uses low temperature for analytical work', () => {
      expect(revisionAgentContract.config.temperature).toBe(0.3)
    })
  })

  describe('execute', () => {
    test('returns error for empty content', async () => {
      const emptyDoc = new DocumentState('')

      const result = await revisionAgentContract.execute(emptyDoc)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content to revise')
      expect(makeCompletion).not.toHaveBeenCalled()
    })

    test('returns error for whitespace-only content', async () => {
      const emptyDoc = new DocumentState('   \n\t  ')

      const result = await revisionAgentContract.execute(emptyDoc)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content to revise')
    })

    test('calls makeCompletion with json format', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Needs work',
        assessments: {},
        priorities: [],
        revisions: []
      })

      await revisionAgentContract.execute(documentState)

      expect(makeCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: 'json',
          temperature: 0.3
        })
      )
    })

    test('creates proposals from revisions', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Several improvements needed',
        assessments: { structure: { score: 'good' } },
        priorities: ['Fix weak verbs'],
        revisions: [
          {
            location: { start: 0, end: 20 },
            problem: 'is very important',
            diagnosis: 'Weak verb + vague qualifier',
            fix: 'matters deeply',
            principle: 'Use strong verbs',
            category: 'style',
            priority: 'important'
          },
          {
            location: { start: 30, end: 50 },
            problem: 'has many uses',
            diagnosis: 'Vague language',
            fix: 'powers three industries',
            principle: 'Be specific',
            category: 'mechanics',
            priority: 'minor'
          }
        ]
      })

      const result = await revisionAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(2)

      const proposals = documentState.getPendingProposals()
      expect(proposals).toHaveLength(2)
      expect(proposals[0].type).toBe('replace')
      expect(proposals[0].agentId).toBe(REVISION_AGENT_ID)
    })

    test('maps category correctly', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        revisions: [
          { location: { start: 0, end: 5 }, fix: 'a', category: 'structure', priority: 'minor' },
          { location: { start: 5, end: 10 }, fix: 'b', category: 'style', priority: 'minor' },
          { location: { start: 10, end: 15 }, fix: 'c', category: 'mechanics', priority: 'minor' }
        ]
      })

      await revisionAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].category).toBe('structure')
      expect(proposals[1].category).toBe('style')
      expect(proposals[2].category).toBe('mechanics')
    })

    test('maps priority correctly', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        revisions: [
          { location: { start: 0, end: 5 }, fix: 'a', category: 'style', priority: 'critical' },
          { location: { start: 5, end: 10 }, fix: 'b', category: 'style', priority: 'important' },
          { location: { start: 10, end: 15 }, fix: 'c', category: 'style', priority: 'minor' }
        ]
      })

      await revisionAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].priority).toBe('critical')
      expect(proposals[1].priority).toBe('important')
      expect(proposals[2].priority).toBe('minor')
    })

    test('skips revisions without required fields', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        revisions: [
          { location: { start: 0, end: 5 }, fix: 'valid', category: 'style', priority: 'minor' },
          { fix: 'no location' },
          { location: { start: 5, end: 10 } } // no fix
        ]
      })

      await revisionAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals).toHaveLength(1)
    })

    test('includes diagnosis and principle in rationale', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        revisions: [
          {
            location: { start: 0, end: 5 },
            problem: 'old',
            diagnosis: 'Weak verb',
            fix: 'new',
            principle: 'Use active voice',
            category: 'style',
            priority: 'minor'
          }
        ]
      })

      await revisionAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].rationale).toContain('Weak verb')
      expect(proposals[0].rationale).toContain('Use active voice')
    })

    test('adds annotation with assessment data', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Overall assessment',
        assessments: { structure: { score: 'good' } },
        priorities: ['Fix weak verbs'],
        revisions: []
      })

      await revisionAgentContract.execute(documentState)

      const annotations = documentState.getAnnotations()
      expect(annotations).toHaveLength(1)
      expect(annotations[0].agentId).toBe(REVISION_AGENT_ID)
      expect(annotations[0].content).toBe('Overall assessment')
    })

    test('passes depth option to system prompt', async () => {
      makeCompletion.mockResolvedValue({ summary: 'Test', revisions: [] })

      await revisionAgentContract.execute(documentState, { depth: 'light' })

      const call = makeCompletion.mock.calls[0][0]
      expect(call.systemPrompt).toContain('Light pass')
    })

    test('handles invalid response format', async () => {
      makeCompletion.mockResolvedValue({ noRevisions: true })

      const result = await revisionAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(0)
    })

    test('handles AI service error', async () => {
      makeCompletion.mockRejectedValue(new Error('Network error'))

      const result = await revisionAgentContract.execute(documentState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })
})
