import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DocumentState } from '../../services/agents/documentState'

vi.mock('../../services/agents/aiService', () => ({
  makeCompletion: vi.fn()
}))

import { makeCompletion } from '../../services/agents/aiService'
import {
  argumentStrengthenerAgentContract,
  ARGUMENT_STRENGTHENER_AGENT_ID
} from '../argumentStrengthenerAgent'

describe('argumentStrengthenerAgent', () => {
  let documentState

  beforeEach(() => {
    documentState = new DocumentState(
      'Remote work increases productivity. Companies should adopt it immediately.',
      { title: 'Remote Work Argument' }
    )
    vi.clearAllMocks()
  })

  describe('contract', () => {
    test('has correct id and stage', () => {
      expect(argumentStrengthenerAgentContract.id).toBe('argument-strengthener-agent')
      expect(argumentStrengthenerAgentContract.stage).toBe('revise')
    })

    test('uses very low temperature for logical analysis', () => {
      expect(argumentStrengthenerAgentContract.config.temperature).toBe(0.2)
    })
  })

  describe('execute', () => {
    test('returns error for empty content', async () => {
      const emptyDoc = new DocumentState('')

      const result = await argumentStrengthenerAgentContract.execute(emptyDoc)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No content to analyze')
      expect(makeCompletion).not.toHaveBeenCalled()
    })

    test('creates INSERT proposals from argument gaps', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Claim lacks evidence',
        thesis: 'Remote work is better',
        claims: [],
        gaps: [
          {
            location: { start: 0, end: 40 },
            type: 'missing-evidence',
            description: 'No data supporting productivity claim',
            impact: 'Core claim unsupported',
            fix: 'Add productivity study data',
            priority: 'critical'
          }
        ],
        counterarguments: {},
        evidenceNeeds: []
      })

      const result = await argumentStrengthenerAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(1)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].type).toBe('insert')
      expect(proposals[0].proposedText).toContain('[TK: Add productivity study data]')
      expect(proposals[0].category).toBe('logic')
      expect(proposals[0].priority).toBe('critical')
      expect(proposals[0].agentId).toBe(ARGUMENT_STRENGTHENER_AGENT_ID)
    })

    test('creates proposals from evidence needs', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Needs more evidence',
        thesis: 'Remote work thesis',
        claims: [],
        gaps: [],
        counterarguments: {},
        evidenceNeeds: [
          {
            claim: 'Remote work increases productivity',
            type: 'empirical-data',
            description: 'Find studies on remote work productivity'
          },
          {
            claim: 'Companies should adopt it',
            type: 'case-study',
            description: 'Find company case studies on remote transition'
          }
        ]
      })

      const result = await argumentStrengthenerAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(2)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].proposedText).toContain('[TK:')
      expect(proposals[0].category).toBe('logic')
      expect(proposals[0].priority).toBe('important')
      expect(proposals[1].metadata.evidenceType).toBe('case-study')
    })

    test('combines gaps and evidence needs', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Multiple issues',
        thesis: 'Thesis',
        claims: [],
        gaps: [
          {
            location: { start: 0, end: 10 },
            type: 'weak-warrant',
            description: 'Weak connection',
            impact: 'Unconvincing',
            fix: 'Explain the mechanism',
            priority: 'important'
          }
        ],
        counterarguments: {},
        evidenceNeeds: [
          {
            claim: 'Claim X',
            type: 'expert-testimony',
            description: 'Find expert opinion'
          }
        ]
      })

      const result = await argumentStrengthenerAgentContract.execute(documentState)

      expect(result.proposalsCreated).toBe(2)
    })

    test('maps priority correctly for gaps', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        gaps: [
          { location: { start: 0, end: 5 }, type: 'x', description: 'd', impact: 'i', fix: 'f', priority: 'critical' },
          { location: { start: 5, end: 10 }, type: 'x', description: 'd', impact: 'i', fix: 'f', priority: 'important' },
          { location: { start: 10, end: 15 }, type: 'x', description: 'd', impact: 'i', fix: 'f', priority: 'minor' }
        ],
        evidenceNeeds: []
      })

      await argumentStrengthenerAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].priority).toBe('critical')
      expect(proposals[1].priority).toBe('important')
      expect(proposals[2].priority).toBe('minor')
    })

    test('skips gaps without required fields', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        gaps: [
          { location: { start: 0, end: 5 }, type: 'x', description: 'd', impact: 'i', fix: 'valid', priority: 'minor' },
          { type: 'x', description: 'd', impact: 'i', fix: 'no location' },
          { location: { start: 5, end: 10 } } // no fix
        ],
        evidenceNeeds: []
      })

      await argumentStrengthenerAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals).toHaveLength(1)
    })

    test('stores gap metadata', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Test',
        gaps: [
          {
            location: { start: 0, end: 10 },
            type: 'logical-fallacy',
            description: 'Hasty generalization',
            impact: 'Weakens argument',
            fix: 'Add more examples',
            priority: 'critical'
          }
        ],
        evidenceNeeds: []
      })

      await argumentStrengthenerAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].metadata.gapType).toBe('logical-fallacy')
      expect(proposals[0].metadata.impact).toBe('Weakens argument')
    })

    test('adds annotation with argument analysis', async () => {
      makeCompletion.mockResolvedValue({
        summary: 'Argument has gaps',
        thesis: 'Remote work is productive',
        claims: [{ claim: 'Productivity rises', hasEvidence: false }],
        gaps: [],
        counterarguments: { claim: 'Office culture matters' },
        evidenceNeeds: []
      })

      await argumentStrengthenerAgentContract.execute(documentState)

      const annotations = documentState.getAnnotations()
      expect(annotations).toHaveLength(1)
      expect(annotations[0].agentId).toBe(ARGUMENT_STRENGTHENER_AGENT_ID)
      expect(annotations[0].category).toBe('logic')
      expect(annotations[0].data.thesis).toBe('Remote work is productive')
      expect(annotations[0].data.counterarguments.claim).toBe('Office culture matters')
    })

    test('handles invalid response format', async () => {
      makeCompletion.mockResolvedValue({ noGaps: true })

      const result = await argumentStrengthenerAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(0)
    })

    test('handles AI service error', async () => {
      makeCompletion.mockRejectedValue(new Error('Service unavailable'))

      const result = await argumentStrengthenerAgentContract.execute(documentState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Service unavailable')
    })
  })
})
