import { describe, test, expect, beforeEach, vi } from 'vitest'
import { Orchestrator, Pipeline } from '../orchestrator'
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

describe('Orchestrator - Pipeline Execution', () => {
  let orchestrator
  let documentState
  let pipeline

  beforeEach(() => {
    orchestrator = new Orchestrator()
    documentState = new DocumentState('Test content')
    pipeline = new Pipeline('Test Pipeline', 'A test pipeline')

    vi.clearAllMocks()
  })

  describe('Pipeline class', () => {
    test('creates pipeline with name and description', () => {
      const p = new Pipeline('My Pipeline', 'Description')

      expect(p.name).toBe('My Pipeline')
      expect(p.description).toBe('Description')
      expect(p.id).toMatch(/^pipeline-/)
      expect(p.createdAt).toBeInstanceOf(Date)
      expect(p.steps).toEqual([])
    })

    test('addStep adds step to pipeline', () => {
      pipeline.addStep('agent-1', { option: 'value' })

      const steps = pipeline.getSteps()
      expect(steps).toHaveLength(1)
      expect(steps[0].agentId).toBe('agent-1')
      expect(steps[0].options).toEqual({ option: 'value' })
      expect(steps[0].order).toBe(0)
    })

    test('addStep returns pipeline for chaining', () => {
      const result = pipeline
        .addStep('agent-1')
        .addStep('agent-2')
        .addStep('agent-3')

      expect(result).toBe(pipeline)
      expect(pipeline.getSteps()).toHaveLength(3)
    })

    test('addStep assigns sequential order numbers', () => {
      pipeline
        .addStep('agent-1')
        .addStep('agent-2')
        .addStep('agent-3')

      const steps = pipeline.getSteps()
      expect(steps[0].order).toBe(0)
      expect(steps[1].order).toBe(1)
      expect(steps[2].order).toBe(2)
    })

    test('getSteps returns copy of steps array', () => {
      pipeline.addStep('agent-1')

      const steps1 = pipeline.getSteps()
      const steps2 = pipeline.getSteps()

      expect(steps1).toEqual(steps2)
      expect(steps1).not.toBe(steps2)
    })

    test('export serializes pipeline', () => {
      pipeline.addStep('agent-1', { opt: 1 })
      pipeline.addStep('agent-2', { opt: 2 })

      const exported = pipeline.export()

      expect(exported.id).toBe(pipeline.id)
      expect(exported.name).toBe('Test Pipeline')
      expect(exported.description).toBe('A test pipeline')
      expect(exported.steps).toHaveLength(2)
      expect(exported.createdAt).toBe(pipeline.createdAt)
    })

    test('import deserializes pipeline', () => {
      const data = {
        id: 'pipeline-123',
        name: 'Imported Pipeline',
        description: 'Imported',
        steps: [
          { agentId: 'agent-1', options: {}, order: 0 },
          { agentId: 'agent-2', options: {}, order: 1 }
        ],
        createdAt: new Date('2024-01-01')
      }

      const imported = Pipeline.import(data)

      expect(imported.id).toBe('pipeline-123')
      expect(imported.name).toBe('Imported Pipeline')
      expect(imported.description).toBe('Imported')
      expect(imported.getSteps()).toHaveLength(2)
      expect(imported.createdAt).toEqual(new Date('2024-01-01'))
    })
  })

  describe('Pipeline registration', () => {
    test('registerPipeline adds pipeline to orchestrator', () => {
      const pipelineId = orchestrator.registerPipeline(pipeline)

      expect(pipelineId).toBe(pipeline.id)
      expect(orchestrator.getPipeline(pipeline.id)).toBe(pipeline)
    })

    test('getPipeline retrieves registered pipeline', () => {
      orchestrator.registerPipeline(pipeline)

      const retrieved = orchestrator.getPipeline(pipeline.id)
      expect(retrieved).toBe(pipeline)
    })

    test('getPipeline returns undefined for non-existent pipeline', () => {
      const retrieved = orchestrator.getPipeline('non-existent')
      expect(retrieved).toBeUndefined()
    })

    test('getAllPipelines returns all registered pipelines', () => {
      const p1 = new Pipeline('Pipeline 1')
      const p2 = new Pipeline('Pipeline 2')
      const p3 = new Pipeline('Pipeline 3')

      orchestrator.registerPipeline(p1)
      orchestrator.registerPipeline(p2)
      orchestrator.registerPipeline(p3)

      const allPipelines = orchestrator.getAllPipelines()
      expect(allPipelines).toHaveLength(3)
    })
  })

  describe('executePipeline', () => {
    let agent1, agent2, agent3

    beforeEach(() => {
      agent1 = {
        id: 'agent-1',
        name: 'Agent 1',
        execute: vi.fn().mockResolvedValue({ success: true, proposalsCount: 1 })
      }

      agent2 = {
        id: 'agent-2',
        name: 'Agent 2',
        execute: vi.fn().mockResolvedValue({ success: true, proposalsCount: 2 })
      }

      agent3 = {
        id: 'agent-3',
        name: 'Agent 3',
        execute: vi.fn().mockResolvedValue({ success: true, proposalsCount: 3 })
      }

      pipeline.addStep('agent-1').addStep('agent-2').addStep('agent-3')
      orchestrator.registerPipeline(pipeline)
    })

    test('executes all steps in sequence', async () => {
      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      const result = await orchestrator.executePipeline(pipeline.id, documentState)

      expect(result.status).toBe('completed')
      expect(result.steps).toHaveLength(3)
      expect(agent1.execute).toHaveBeenCalledTimes(1)
      expect(agent2.execute).toHaveBeenCalledTimes(1)
      expect(agent3.execute).toHaveBeenCalledTimes(1)
    })

    test('calls onStepStart callback for each step', async () => {
      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      const onStepStart = vi.fn()

      await orchestrator.executePipeline(pipeline.id, documentState, {
        onStepStart
      })

      expect(onStepStart).toHaveBeenCalledTimes(3)
      expect(onStepStart).toHaveBeenNthCalledWith(1, 0, expect.any(Object))
      expect(onStepStart).toHaveBeenNthCalledWith(2, 1, expect.any(Object))
      expect(onStepStart).toHaveBeenNthCalledWith(3, 2, expect.any(Object))
    })

    test('calls onStepComplete callback for each step', async () => {
      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      const onStepComplete = vi.fn()

      await orchestrator.executePipeline(pipeline.id, documentState, {
        onStepComplete
      })

      expect(onStepComplete).toHaveBeenCalledTimes(3)
      expect(onStepComplete).toHaveBeenNthCalledWith(
        1,
        0,
        expect.any(Object),
        expect.objectContaining({ success: true })
      )
    })

    test('calls onProgress callback during execution', async () => {
      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      const onProgress = vi.fn()

      // Make agent call onProgress
      agent1.execute.mockImplementation(async (doc, opts) => {
        if (opts.onProgress) opts.onProgress({ progress: 50 })
        return { success: true }
      })

      await orchestrator.executePipeline(pipeline.id, documentState, {
        onProgress
      })

      expect(onProgress).toHaveBeenCalled()
      expect(onProgress).toHaveBeenCalledWith(0, { progress: 50 })
    })

    test('aborts previous step stream before starting next', async () => {
      const abort1 = vi.fn()
      const abort2 = vi.fn()

      agent1.execute.mockResolvedValue({ success: true, abort: abort1 })
      agent2.execute.mockResolvedValue({ success: true, abort: abort2 })
      agent3.execute.mockResolvedValue({ success: true })

      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      await orchestrator.executePipeline(pipeline.id, documentState)

      // First step's abort should be called when starting second step
      expect(abort1).toHaveBeenCalled()
      // Second step's abort should be called when starting third step
      expect(abort2).toHaveBeenCalled()
    })

    test('stops pipeline when step fails', async () => {
      agent2.execute.mockResolvedValue({
        success: false,
        error: 'Step 2 failed'
      })

      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      await expect(
        orchestrator.executePipeline(pipeline.id, documentState)
      ).rejects.toThrow('Step 1 (Agent 2) failed')

      expect(agent1.execute).toHaveBeenCalledTimes(1)
      expect(agent2.execute).toHaveBeenCalledTimes(1)
      expect(agent3.execute).not.toHaveBeenCalled()
    })

    test('records execution result on success', async () => {
      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      const result = await orchestrator.executePipeline(pipeline.id, documentState)

      expect(result.pipelineId).toBe(pipeline.id)
      expect(result.status).toBe('completed')
      expect(result.startedAt).toBeInstanceOf(Date)
      expect(result.completedAt).toBeInstanceOf(Date)
      expect(result.steps).toHaveLength(3)
      expect(result.error).toBeNull()
    })

    test('records execution result on failure', async () => {
      agent2.execute.mockResolvedValue({ success: false, error: 'Failed' })

      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)

      try {
        await orchestrator.executePipeline(pipeline.id, documentState)
      } catch (error) {
        // Expected
      }

      const history = orchestrator.getExecutionHistory()
      expect(history).toHaveLength(1)
      expect(history[0].status).toBe('failed')
      expect(history[0].error).toBeTruthy()
    })

    test('clears currentExecution and currentAbort after completion', async () => {
      agentRegistry.getAgent
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2)
        .mockReturnValueOnce(agent3)

      await orchestrator.executePipeline(pipeline.id, documentState)

      expect(orchestrator.currentExecution).toBeNull()
      expect(orchestrator.currentAbort).toBeNull()
    })

    test('throws error when pipeline not found', async () => {
      await expect(
        orchestrator.executePipeline('non-existent', documentState)
      ).rejects.toThrow('Pipeline non-existent not found')
    })

    test('passes step options to agent', async () => {
      const pipelineWithOptions = new Pipeline('Options Test')
      pipelineWithOptions.addStep('agent-1', { temperature: 0.8, maxTokens: 500 })

      orchestrator.registerPipeline(pipelineWithOptions)
      agentRegistry.getAgent.mockReturnValue(agent1)

      await orchestrator.executePipeline(pipelineWithOptions.id, documentState)

      expect(agent1.execute).toHaveBeenCalledWith(
        documentState,
        expect.objectContaining({ temperature: 0.8, maxTokens: 500 })
      )
    })

    test('handles single-step pipeline', async () => {
      const singleStepPipeline = new Pipeline('Single Step')
      singleStepPipeline.addStep('agent-1')

      orchestrator.registerPipeline(singleStepPipeline)
      agentRegistry.getAgent.mockReturnValue(agent1)

      const result = await orchestrator.executePipeline(
        singleStepPipeline.id,
        documentState
      )

      expect(result.status).toBe('completed')
      expect(result.steps).toHaveLength(1)
    })
  })

  describe('cancelCurrentExecution', () => {
    let agent1, agent2

    beforeEach(() => {
      agent1 = {
        id: 'agent-1',
        execute: vi.fn().mockResolvedValue({ success: true })
      }
      agent2 = {
        id: 'agent-2',
        execute: vi.fn().mockResolvedValue({ success: true })
      }

      pipeline.addStep('agent-1').addStep('agent-2')
      orchestrator.registerPipeline(pipeline)
    })

    test('aborts stream during pipeline execution', async () => {
      const abortFn = vi.fn()
      agent1.execute.mockResolvedValue({ success: true, abort: abortFn })

      agentRegistry.getAgent.mockReturnValue(agent1)

      // Start pipeline execution but don't await
      const executionPromise = orchestrator.executePipeline(
        pipeline.id,
        documentState
      )

      // Give it time to start
      await new Promise(resolve => setTimeout(resolve, 10))

      // Cancel during execution
      orchestrator.cancelCurrentExecution()

      expect(abortFn).toHaveBeenCalled()

      // Wait for pipeline to complete/fail
      try {
        await executionPromise
      } catch (e) {
        // Expected to throw
      }
    })

    test('marks execution as cancelled', async () => {
      const { PipelineExecutionResult } = await import('../orchestrator')

      agentRegistry.getAgent.mockReturnValue(agent1)

      // Set up currentExecution with real PipelineExecutionResult
      const execution = new PipelineExecutionResult(pipeline.id)
      orchestrator.currentExecution = execution

      orchestrator.cancelCurrentExecution()

      expect(orchestrator.currentExecution).toBeNull()
      const history = orchestrator.getExecutionHistory()
      expect(history).toHaveLength(1)
      expect(history[0].status).toBe('cancelled')
    })
  })

  describe('getExecutionHistory', () => {
    test('returns empty array when no executions', () => {
      const history = orchestrator.getExecutionHistory()
      expect(history).toEqual([])
    })

    test('tracks successful executions', async () => {
      const agent = {
        execute: vi.fn().mockResolvedValue({ success: true })
      }

      pipeline.addStep('agent-1')
      orchestrator.registerPipeline(pipeline)
      agentRegistry.getAgent.mockReturnValue(agent)

      await orchestrator.executePipeline(pipeline.id, documentState)

      const history = orchestrator.getExecutionHistory()
      expect(history).toHaveLength(1)
      expect(history[0].pipelineId).toBe(pipeline.id)
      expect(history[0].status).toBe('completed')
    })

    test('tracks failed executions', async () => {
      const agent = {
        execute: vi.fn().mockResolvedValue({ success: false, error: 'Failed' })
      }

      pipeline.addStep('agent-1')
      orchestrator.registerPipeline(pipeline)
      agentRegistry.getAgent.mockReturnValue(agent)

      try {
        await orchestrator.executePipeline(pipeline.id, documentState)
      } catch (e) {
        // Expected
      }

      const history = orchestrator.getExecutionHistory()
      expect(history).toHaveLength(1)
      expect(history[0].status).toBe('failed')
    })

    test('returns copy of execution history', () => {
      const history1 = orchestrator.getExecutionHistory()
      const history2 = orchestrator.getExecutionHistory()

      expect(history1).toEqual(history2)
      expect(history1).not.toBe(history2)
    })
  })
})
