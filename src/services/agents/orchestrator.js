/**
 * Agent Orchestrator
 *
 * Coordinates running multiple agents in sequence or parallel.
 * Manages pipelines and workflow execution.
 */

import { getAgent, AGENT_STAGES } from './agentRegistry'
import { DocumentState } from './documentState'

/**
 * Pipeline definition
 */
export class Pipeline {
  constructor(name, description = '') {
    this.id = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.name = name
    this.description = description
    this.steps = []
    this.createdAt = new Date()
  }

  /**
   * Add a step to the pipeline
   */
  addStep(agentId, options = {}) {
    this.steps.push({
      agentId,
      options,
      order: this.steps.length
    })
    return this
  }

  /**
   * Get all steps
   */
  getSteps() {
    return [...this.steps]
  }

  /**
   * Export pipeline definition
   */
  export() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      steps: this.steps,
      createdAt: this.createdAt
    }
  }

  /**
   * Import pipeline from definition
   */
  static import(data) {
    const pipeline = new Pipeline(data.name, data.description)
    pipeline.id = data.id
    pipeline.steps = data.steps || []
    pipeline.createdAt = data.createdAt
    return pipeline
  }
}

/**
 * Pipeline execution result
 */
export class PipelineExecutionResult {
  constructor(pipelineId) {
    this.pipelineId = pipelineId
    this.startedAt = new Date()
    this.completedAt = null
    this.status = 'running' // 'running', 'completed', 'failed', 'cancelled'
    this.steps = []
    this.error = null
  }

  addStepResult(stepIndex, result) {
    this.steps.push({
      stepIndex,
      result,
      completedAt: new Date()
    })
  }

  complete() {
    this.status = 'completed'
    this.completedAt = new Date()
  }

  fail(error) {
    this.status = 'failed'
    this.error = error
    this.completedAt = new Date()
  }

  cancel() {
    this.status = 'cancelled'
    this.completedAt = new Date()
  }
}

/**
 * Orchestrator class
 */
export class Orchestrator {
  constructor() {
    this.pipelines = new Map()
    this.executionHistory = []
    this.currentExecution = null
    this.currentAbort = null // Track current stream abort function
  }

  /**
   * Register a pipeline
   */
  registerPipeline(pipeline) {
    this.pipelines.set(pipeline.id, pipeline)
    return pipeline.id
  }

  /**
   * Get a pipeline by ID
   */
  getPipeline(pipelineId) {
    return this.pipelines.get(pipelineId)
  }

  /**
   * Get all pipelines
   */
  getAllPipelines() {
    return Array.from(this.pipelines.values())
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(pipelineId, documentState, options = {}) {
    const pipeline = this.getPipeline(pipelineId)
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`)
    }

    const {
      onStepStart = null,
      onStepComplete = null,
      onProgress = null
    } = options

    const execution = new PipelineExecutionResult(pipelineId)
    this.currentExecution = execution

    try {
      const steps = pipeline.getSteps()

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]

        // Abort previous step's stream before starting next
        if (this.currentAbort) {
          this.currentAbort()
          this.currentAbort = null
        }

        // Notify step start
        if (onStepStart) {
          onStepStart(i, step)
        }

        // Get agent
        const agent = getAgent(step.agentId)
        if (!agent) {
          throw new Error(`Agent ${step.agentId} not found`)
        }

        // Execute agent
        const result = await agent.execute(documentState, {
          ...step.options,
          onProgress: onProgress ? (data) => onProgress(i, data) : null
        })

        // Store abort function for this step
        if (result.abort) {
          this.currentAbort = result.abort
        }

        // Record result
        execution.addStepResult(i, result)

        // Notify step complete
        if (onStepComplete) {
          onStepComplete(i, step, result)
        }

        // Check if failed
        if (!result.success) {
          throw new Error(`Step ${i} (${agent.name}) failed: ${result.error}`)
        }
      }

      execution.complete()
      this.executionHistory.push(execution)
      this.currentExecution = null
      this.currentAbort = null

      return execution
    } catch (error) {
      // Abort streaming request if active
      if (this.currentAbort) {
        this.currentAbort()
      }

      execution.fail(error.message)
      this.executionHistory.push(execution)
      this.currentExecution = null
      this.currentAbort = null
      throw error
    }
  }

  /**
   * Execute a single agent
   */
  async executeAgent(agentId, documentState, options = {}) {
    // Abort previous agent's stream before starting new one
    if (this.currentAbort) {
      this.currentAbort()
      this.currentAbort = null
    }

    const agent = getAgent(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    const result = await agent.execute(documentState, options)

    // Store abort function if returned for potential cancellation
    if (result.abort) {
      this.currentAbort = result.abort
    }

    return result
  }

  /**
   * Get execution history
   */
  getExecutionHistory() {
    return [...this.executionHistory]
  }

  /**
   * Cancel current execution
   */
  cancelCurrentExecution() {
    // Abort streaming request if active
    if (this.currentAbort) {
      this.currentAbort()
      this.currentAbort = null
    }

    if (this.currentExecution) {
      this.currentExecution.cancel()
      this.executionHistory.push(this.currentExecution)
      this.currentExecution = null
    }
  }
}

/**
 * Pre-defined pipelines
 */

/**
 * Create "Blog Post" pipeline
 * Brainstorm → Draft → Revise → Edit
 */
export function createBlogPostPipeline() {
  const pipeline = new Pipeline(
    'Blog Post Pipeline',
    'Complete workflow from brainstorming to polished blog post'
  )

  pipeline
    .addStep('brainstorm-agent', { focusArea: 'angles', count: 5 })
    .addStep('draft-agent', { targetWords: 800 })
    .addStep('revision-agent', { depth: 'full', focus: 'all' })
    .addStep('editor-agent', { focus: 'all' })

  return pipeline
}

/**
 * Create "Quick Draft" pipeline
 * Draft → Edit
 */
export function createQuickDraftPipeline() {
  const pipeline = new Pipeline(
    'Quick Draft Pipeline',
    'Fast draft with basic editing'
  )

  pipeline
    .addStep('draft-agent', { targetWords: 500 })
    .addStep('editor-agent', { focus: 'clarity' })

  return pipeline
}

/**
 * Create "Argument Analysis" pipeline
 * Argument Strengthener → Revision → Edit
 */
export function createArgumentAnalysisPipeline() {
  const pipeline = new Pipeline(
    'Argument Analysis Pipeline',
    'Deep analysis and strengthening of arguments'
  )

  pipeline
    .addStep('argument-strengthener-agent')
    .addStep('revision-agent', { depth: 'medium', focus: 'all' })
    .addStep('editor-agent', { focus: 'clarity' })

  return pipeline
}

/**
 * Create "Polish Only" pipeline
 * Revision → Edit
 */
export function createPolishPipeline() {
  const pipeline = new Pipeline(
    'Polish Pipeline',
    'Final polish for nearly-complete content'
  )

  pipeline
    .addStep('revision-agent', { depth: 'light', focus: 'style' })
    .addStep('editor-agent', { focus: 'all' })

  return pipeline
}

// Singleton instance
let orchestratorInstance = null

/**
 * Get orchestrator instance
 */
export function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator()

    // Register pre-defined pipelines
    orchestratorInstance.registerPipeline(createBlogPostPipeline())
    orchestratorInstance.registerPipeline(createQuickDraftPipeline())
    orchestratorInstance.registerPipeline(createArgumentAnalysisPipeline())
    orchestratorInstance.registerPipeline(createPolishPipeline())
  }

  return orchestratorInstance
}
