import { describe, test, expect, beforeEach, vi } from 'vitest'
import { Orchestrator } from '../orchestrator'
import { DocumentState } from '../documentState'
import * as agentRegistry from '../agentRegistry'

// Mock agentRegistry
vi.mock('../agentRegistry', async () => {
  const actual = await vi.importActual('../agentRegistry')
  return {
    ...actual,
    getAgent: vi.fn()
  }
})

describe('Orchestrator - Agent Execution', () => {
  let orchestrator
  let documentState
  let mockAgent

  beforeEach(() => {
    orchestrator = new Orchestrator()
    documentState = new DocumentState('Test content')

    // Create mock agent
    mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      execute: vi.fn().mockResolvedValue({
        success: true,
        proposalsCount: 0,
        message: 'Test execution complete'
      })
    }

    // Reset mocks
    vi.clearAllMocks()
  })

  describe('executeAgent', () => {
    test('calls agent.execute with documentState and options', async () => {
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      const options = { testOption: 'value' }
      await orchestrator.executeAgent('test-agent', documentState, options)

      expect(agentRegistry.getAgent).toHaveBeenCalledWith('test-agent')
      expect(mockAgent.execute).toHaveBeenCalledWith(documentState, options)
    })

    test('returns agent execution result', async () => {
      const expectedResult = {
        success: true,
        proposalsCount: 3,
        message: 'Generated 3 proposals'
      }
      mockAgent.execute.mockResolvedValue(expectedResult)
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      const result = await orchestrator.executeAgent('test-agent', documentState)

      expect(result).toEqual(expectedResult)
    })

    test('stores abort function if returned by agent', async () => {
      const abortFn = vi.fn()
      mockAgent.execute.mockResolvedValue({
        success: true,
        proposalsCount: 0,
        abort: abortFn
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      await orchestrator.executeAgent('test-agent', documentState)

      expect(orchestrator.currentAbort).toBe(abortFn)
    })

    test('does not store abort function if not returned', async () => {
      mockAgent.execute.mockResolvedValue({
        success: true,
        proposalsCount: 0
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      await orchestrator.executeAgent('test-agent', documentState)

      expect(orchestrator.currentAbort).toBeNull()
    })

    test('aborts previous agent before starting new one', async () => {
      const abortFn1 = vi.fn()
      const abortFn2 = vi.fn()

      mockAgent.execute
        .mockResolvedValueOnce({
          success: true,
          abort: abortFn1
        })
        .mockResolvedValueOnce({
          success: true,
          abort: abortFn2
        })

      agentRegistry.getAgent.mockReturnValue(mockAgent)

      await orchestrator.executeAgent('test-agent', documentState)
      expect(orchestrator.currentAbort).toBe(abortFn1)

      await orchestrator.executeAgent('test-agent', documentState)
      expect(abortFn1).toHaveBeenCalled()
      expect(orchestrator.currentAbort).toBe(abortFn2)
    })

    test('throws error when agent not found', async () => {
      agentRegistry.getAgent.mockReturnValue(undefined)

      await expect(
        orchestrator.executeAgent('non-existent', documentState)
      ).rejects.toThrow('Agent non-existent not found')
    })

    test('handles agent execution error', async () => {
      const executionError = new Error('Agent execution failed')
      mockAgent.execute.mockRejectedValue(executionError)
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      await expect(
        orchestrator.executeAgent('test-agent', documentState)
      ).rejects.toThrow('Agent execution failed')
    })

    test('passes options to agent', async () => {
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      const options = {
        temperature: 0.7,
        maxTokens: 1000
      }

      await orchestrator.executeAgent('test-agent', documentState, options)

      expect(mockAgent.execute).toHaveBeenCalledWith(documentState, options)
    })

    test('executes multiple agents sequentially', async () => {
      const agent1 = {
        id: 'agent-1',
        execute: vi.fn().mockResolvedValue({ success: true })
      }
      const agent2 = {
        id: 'agent-2',
        execute: vi.fn().mockResolvedValue({ success: true })
      }

      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)

      await orchestrator.executeAgent('agent-1', documentState)
      await orchestrator.executeAgent('agent-2', documentState)

      expect(agent1.execute).toHaveBeenCalledTimes(1)
      expect(agent2.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancelCurrentExecution', () => {
    test('calls abort function when available', async () => {
      const abortFn = vi.fn()
      mockAgent.execute.mockResolvedValue({
        success: true,
        abort: abortFn
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      await orchestrator.executeAgent('test-agent', documentState)

      orchestrator.cancelCurrentExecution()

      expect(abortFn).toHaveBeenCalled()
      expect(orchestrator.currentAbort).toBeNull()
    })

    test('does not throw when no abort function available', () => {
      expect(() => {
        orchestrator.cancelCurrentExecution()
      }).not.toThrow()
    })

    test('clears currentAbort after cancelling', async () => {
      const abortFn = vi.fn()
      mockAgent.execute.mockResolvedValue({
        success: true,
        abort: abortFn
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      await orchestrator.executeAgent('test-agent', documentState)
      expect(orchestrator.currentAbort).toBe(abortFn)

      orchestrator.cancelCurrentExecution()
      expect(orchestrator.currentAbort).toBeNull()
    })

    test('cancels current execution if running', async () => {
      const abortFn = vi.fn()

      // Mock a long-running agent execution
      let resolveExecution
      const executionPromise = new Promise(resolve => {
        resolveExecution = resolve
      })

      mockAgent.execute.mockReturnValue(executionPromise)
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      // Start execution but don't await
      const executionTask = orchestrator.executeAgent('test-agent', documentState)

      // Set up abort function manually (simulating agent setup)
      orchestrator.currentAbort = abortFn
      orchestrator.currentExecution = { cancel: vi.fn() }

      // Cancel while running
      orchestrator.cancelCurrentExecution()

      expect(abortFn).toHaveBeenCalled()
      expect(orchestrator.currentExecution).toBeNull()

      // Clean up
      resolveExecution({ success: true })
      await executionTask
    })
  })

  describe('Agent result handling', () => {
    test('handles agent returning proposals', async () => {
      const proposals = [
        { id: 'p1', type: 'replace', originalText: 'old', proposedText: 'new' },
        { id: 'p2', type: 'insert', originalText: '', proposedText: 'added' }
      ]

      mockAgent.execute.mockResolvedValue({
        success: true,
        proposalsCount: 2,
        proposals
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      const result = await orchestrator.executeAgent('test-agent', documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCount).toBe(2)
      expect(result.proposals).toEqual(proposals)
    })

    test('handles agent with no proposals', async () => {
      mockAgent.execute.mockResolvedValue({
        success: true,
        proposalsCount: 0,
        message: 'Analysis complete, no changes needed'
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      const result = await orchestrator.executeAgent('test-agent', documentState)

      expect(result.success).toBe(true)
      expect(result.proposalsCount).toBe(0)
    })

    test('handles agent execution failure', async () => {
      mockAgent.execute.mockResolvedValue({
        success: false,
        error: 'API rate limit exceeded'
      })
      agentRegistry.getAgent.mockReturnValue(mockAgent)

      const result = await orchestrator.executeAgent('test-agent', documentState)

      expect(result.success).toBe(false)
      expect(result.error).toBe('API rate limit exceeded')
    })
  })
})
