import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DocumentState } from '../../services/agents/documentState'

// Mock aiService
vi.mock('../../services/agents/aiService', () => ({
  makeCompletion: vi.fn()
}))

import { makeCompletion } from '../../services/agents/aiService'
import { brainstormAgentContract, BRAINSTORM_AGENT_ID } from '../brainstormAgent'

describe('brainstormAgent', () => {
  let documentState

  beforeEach(() => {
    documentState = new DocumentState('Some existing content about technology.', {
      title: 'Tech Article'
    })
    vi.clearAllMocks()
  })

  describe('contract', () => {
    test('has correct id and stage', () => {
      expect(brainstormAgentContract.id).toBe('brainstorm-agent')
      expect(brainstormAgentContract.stage).toBe('brainstorm')
    })

    test('uses high temperature for creativity', () => {
      expect(brainstormAgentContract.config.temperature).toBe(0.9)
    })

    test('has execute function', () => {
      expect(typeof brainstormAgentContract.execute).toBe('function')
    })
  })

  describe('execute', () => {
    test('calls makeCompletion with json responseFormat', async () => {
      makeCompletion.mockResolvedValue({
        ideas: [
          { title: 'Idea 1', description: 'Description 1', reasoning: 'Reasoning 1' }
        ]
      })

      await brainstormAgentContract.execute(documentState)

      expect(makeCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          responseFormat: 'json',
          model: 'gpt-4o',
          temperature: 0.9
        })
      )
    })

    test('creates proposals for each idea returned', async () => {
      makeCompletion.mockResolvedValue({
        ideas: [
          { title: 'Idea A', description: 'Desc A', reasoning: 'Why A' },
          { title: 'Idea B', description: 'Desc B', reasoning: 'Why B' },
          { title: 'Idea C', description: 'Desc C', reasoning: 'Why C' }
        ]
      })

      const result = await brainstormAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(3)
      expect(documentState.getPendingProposals()).toHaveLength(3)
    })

    test('creates INSERT-type proposals at end of document', async () => {
      makeCompletion.mockResolvedValue({
        ideas: [
          { title: 'New Idea', description: 'A new direction', reasoning: 'Worth exploring' }
        ]
      })

      await brainstormAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].type).toBe('insert')
      expect(proposals[0].proposedText).toContain('## New Idea')
      expect(proposals[0].proposedText).toContain('A new direction')
      expect(proposals[0].agentId).toBe(BRAINSTORM_AGENT_ID)
      expect(proposals[0].category).toBe('content')
      expect(proposals[0].priority).toBe('minor')
    })

    test('adds annotation with brainstorm results', async () => {
      makeCompletion.mockResolvedValue({
        ideas: [{ title: 'Idea', description: 'Desc', reasoning: 'Why' }]
      })

      await brainstormAgentContract.execute(documentState)

      const annotations = documentState.getAnnotations()
      expect(annotations).toHaveLength(1)
      expect(annotations[0].agentId).toBe(BRAINSTORM_AGENT_ID)
      expect(annotations[0].category).toBe('brainstorm')
    })

    test('passes focusArea and count options', async () => {
      makeCompletion.mockResolvedValue({ ideas: [] })

      await brainstormAgentContract.execute(documentState, {
        focusArea: 'counterarguments',
        count: 3,
        prompt: 'Focus on weak points'
      })

      const call = makeCompletion.mock.calls[0][0]
      expect(call.systemPrompt).toContain('counterarguments')
      expect(call.userPrompt).toContain('3 counterarguments ideas')
      expect(call.userPrompt).toContain('Focus on weak points')
    })

    test('returns empty proposals for invalid response format', async () => {
      makeCompletion.mockResolvedValue({ notIdeas: 'bad format' })

      const result = await brainstormAgentContract.execute(documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(0)
    })

    test('handles AI service error gracefully', async () => {
      makeCompletion.mockRejectedValue(new Error('API key not configured'))

      const result = await brainstormAgentContract.execute(documentState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key not configured')
    })

    test('includes document content in user prompt', async () => {
      makeCompletion.mockResolvedValue({ ideas: [] })

      await brainstormAgentContract.execute(documentState)

      const call = makeCompletion.mock.calls[0][0]
      expect(call.userPrompt).toContain('Some existing content about technology.')
    })

    test('works with empty document', async () => {
      const emptyDoc = new DocumentState('')
      makeCompletion.mockResolvedValue({
        ideas: [{ title: 'Start Here', description: 'Begin with...', reasoning: 'Fresh start' }]
      })

      const result = await brainstormAgentContract.execute(emptyDoc)

      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(1)
    })
  })
})
