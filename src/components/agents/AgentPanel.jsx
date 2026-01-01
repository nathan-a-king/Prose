/**
 * Agent Panel Component
 *
 * Main UI for the multi-agent editorial system.
 * Shows available agents, pipelines, and execution controls.
 */

import { useState } from 'react'
import { useAgents } from '../../contexts/AgentContext'
import { AGENT_STAGES } from '../../agents'

export default function AgentPanel({ onClose, onAgentSelected }) {
  const {
    agents,
    pipelines,
    executeAgent,
    executePipeline,
    isExecuting,
    currentStep,
    executionProgress,
    cancelExecution
  } = useAgents()

  const [selectedTab, setSelectedTab] = useState('agents') // 'agents' | 'pipelines'
  const [selectedStage, setSelectedStage] = useState('all')

  // Filter agents by stage
  const filteredAgents = selectedStage === 'all'
    ? agents
    : agents.filter(agent => agent.stage === selectedStage)

  // Handle agent execution - now triggers options panel
  const handleExecuteAgent = async (agentId) => {
    try {
      // If onAgentSelected is provided, use Promptions flow
      if (onAgentSelected) {
        onAgentSelected(agentId)
      } else {
        // Fallback to direct execution
        await executeAgent(agentId)
      }
    } catch (error) {
      console.error('Agent execution failed:', error)
    }
  }

  // Handle pipeline execution
  const handleExecutePipeline = async (pipelineId) => {
    try {
      await executePipeline(pipelineId)
    } catch (error) {
      console.error('Pipeline execution failed:', error)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              AI Editorial Pipeline
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Multi-agent writing assistance
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setSelectedTab('agents')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedTab === 'agents'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-600'
            }`}
          >
            Agents
          </button>
          <button
            onClick={() => setSelectedTab('pipelines')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedTab === 'pipelines'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-600'
            }`}
          >
            Pipelines
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedTab === 'agents' && (
          <div>
            {/* Stage Filter */}
            <div className="mb-4">
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Stages</option>
                <option value={AGENT_STAGES.BRAINSTORM}>Brainstorm</option>
                <option value={AGENT_STAGES.DRAFT}>Draft</option>
                <option value={AGENT_STAGES.REVISE}>Revise</option>
                <option value={AGENT_STAGES.EDIT}>Edit</option>
              </select>
            </div>

            {/* Agent List */}
            <div className="space-y-3">
              {filteredAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onExecute={() => handleExecuteAgent(agent.id)}
                  isExecuting={isExecuting}
                  isCurrentlyRunning={
                    executionProgress?.type === 'agent' &&
                    executionProgress?.agentId === agent.id &&
                    executionProgress?.status === 'running'
                  }
                />
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'pipelines' && (
          <div className="space-y-3">
            {pipelines.map(pipeline => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                onExecute={() => handleExecutePipeline(pipeline.id)}
                isExecuting={isExecuting}
                isCurrentlyRunning={
                  executionProgress?.type === 'pipeline' &&
                  executionProgress?.pipelineId === pipeline.id &&
                  executionProgress?.status === 'running'
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Execution Status */}
      {isExecuting && (
        <div className="flex-none p-4 border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin-gpu"
              ></div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {executionProgress?.type === 'pipeline' ? 'Running Pipeline...' : 'Running Agent...'}
                </p>
                {currentStep && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Step {currentStep.stepIndex + 1}: {currentStep.step.agentId}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={cancelExecution}
              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Agent Card Component
 */
function AgentCard({ agent, onExecute, isExecuting, isCurrentlyRunning }) {
  const stageColors = {
    [AGENT_STAGES.BRAINSTORM]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    [AGENT_STAGES.DRAFT]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    [AGENT_STAGES.REVISE]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    [AGENT_STAGES.EDIT]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  }

  return (
    <div className="p-4 border border-gray-200 dark:border-neutral-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {agent.name}
            </h3>
            <span className={`px-2 py-0.5 text-xs rounded ${stageColors[agent.stage] || 'bg-gray-100 text-gray-800'}`}>
              {agent.stage}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {agent.description}
          </p>
        </div>
        <button
          onClick={onExecute}
          disabled={isExecuting}
          className={`flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-md transition-colors min-w-[80px] ${
            isCurrentlyRunning
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : isExecuting
              ? 'bg-gray-100 dark:bg-neutral-700 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300'
          }`}
        >
          {isCurrentlyRunning ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
  )
}

/**
 * Pipeline Card Component
 */
function PipelineCard({ pipeline, onExecute, isExecuting, isCurrentlyRunning }) {
  return (
    <div className="p-4 border border-gray-200 dark:border-neutral-700 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {pipeline.name}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {pipeline.description}
          </p>
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {pipeline.steps.map((step, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {step.agentId.replace('-agent', '')}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onExecute}
          disabled={isExecuting}
          className={`flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-md transition-colors min-w-[80px] ${
            isCurrentlyRunning
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : isExecuting
              ? 'bg-gray-100 dark:bg-neutral-700 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300'
          }`}
        >
          {isCurrentlyRunning ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
  )
}
