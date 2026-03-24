import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DocumentState } from '../../services/agents/documentState'

vi.mock('../../services/agents/aiService', () => ({
  makeCompletion: vi.fn(),
  makeStreamingCompletion: vi.fn()
}))

import { makeCompletion, makeStreamingCompletion } from '../../services/agents/aiService'
import { draftAgentContract, DRAFT_AGENT_ID } from '../draftAgent'

describe('draftAgent', () => {
  let documentState

  beforeEach(() => {
    documentState = new DocumentState('Existing content here.', {
      title: 'My Draft'
    })
    vi.clearAllMocks()
  })

  describe('contract', () => {
    test('has correct id and stage', () => {
      expect(draftAgentContract.id).toBe('draft-agent')
      expect(draftAgentContract.stage).toBe('draft')
    })

    test('uses moderately high temperature', () => {
      expect(draftAgentContract.config.temperature).toBe(0.8)
    })
  })

  describe('execute - non-streaming', () => {
    test('calls makeCompletion when no onProgress callback', async () => {
      makeCompletion.mockResolvedValue('Generated draft content for the article.')

      const result = await draftAgentContract.execute(documentState)

      expect(makeCompletion).toHaveBeenCalledTimes(1)
      expect(makeStreamingCompletion).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.proposalsCreated).toBe(1)
      expect(result.draftContent).toBe('Generated draft content for the article.')
    })

    test('creates REPLACE proposal for non-empty document', async () => {
      makeCompletion.mockResolvedValue('New draft replaces old content.')

      await draftAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals).toHaveLength(1)
      expect(proposals[0].type).toBe('replace')
      expect(proposals[0].originalText).toBe('Existing content here.')
      expect(proposals[0].proposedText).toBe('New draft replaces old content.')
      expect(proposals[0].agentId).toBe(DRAFT_AGENT_ID)
      expect(proposals[0].category).toBe('content')
      expect(proposals[0].priority).toBe('important')
    })

    test('creates REPLACE proposal for empty document', async () => {
      const emptyDoc = new DocumentState('')
      makeCompletion.mockResolvedValue('Brand new draft.')

      await draftAgentContract.execute(emptyDoc)

      const proposals = emptyDoc.getPendingProposals()
      expect(proposals[0].type).toBe('replace')
      expect(proposals[0].originalText).toBe('')
      expect(proposals[0].location).toEqual({ start: 0, end: 0 })
    })

    test('includes word count and TK count in proposal metadata', async () => {
      makeCompletion.mockResolvedValue(
        'This is a draft with [TK: cite source] and [TK: add example] placeholders.'
      )

      await draftAgentContract.execute(documentState)

      const proposals = documentState.getPendingProposals()
      expect(proposals[0].metadata.wordCount).toBeGreaterThan(0)
      expect(proposals[0].metadata.tkCount).toBe(2)
    })

    test('adds annotation with word count', async () => {
      makeCompletion.mockResolvedValue('Five words in this draft.')

      await draftAgentContract.execute(documentState)

      const annotations = documentState.getAnnotations()
      expect(annotations).toHaveLength(1)
      expect(annotations[0].agentId).toBe(DRAFT_AGENT_ID)
      expect(annotations[0].content).toContain('5 words')
    })

    test('passes targetWords and outline in prompt', async () => {
      makeCompletion.mockResolvedValue('Draft output.')

      await draftAgentContract.execute(documentState, {
        prompt: 'Write about AI',
        outline: '1. Intro\n2. Body\n3. Conclusion',
        targetWords: 1000
      })

      const call = makeCompletion.mock.calls[0][0]
      expect(call.userPrompt).toContain('Write about AI')
      expect(call.userPrompt).toContain('1. Intro')
      expect(call.userPrompt).toContain('1000 words')
    })
  })

  describe('execute - streaming', () => {
    test('calls makeStreamingCompletion when onProgress provided', async () => {
      const abortFn = vi.fn()
      makeStreamingCompletion.mockImplementation(async (opts, onChunk) => {
        onChunk('First ')
        onChunk('chunk.')
        return abortFn
      })

      const onProgress = vi.fn()
      const result = await draftAgentContract.execute(documentState, { onProgress })

      expect(makeStreamingCompletion).toHaveBeenCalledTimes(1)
      expect(makeCompletion).not.toHaveBeenCalled()
      expect(onProgress).toHaveBeenCalledWith('First ')
      expect(onProgress).toHaveBeenCalledWith('First chunk.')
      expect(result.success).toBe(true)
      expect(result.abort).toBe(abortFn)
    })
  })

  describe('error handling', () => {
    test('returns failure on AI service error', async () => {
      makeCompletion.mockRejectedValue(new Error('Rate limit exceeded'))

      const result = await draftAgentContract.execute(documentState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })
  })
})
