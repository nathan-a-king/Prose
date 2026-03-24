import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentProvider, useAgents } from '../AgentContext'
import * as agents from '../../agents'
import * as orchestrator from '../../services/agents/orchestrator'

// Mock modules
vi.mock('../../agents', () => ({
  initializeAgentSystem: vi.fn(),
  getAllAgents: vi.fn(() => []),
  getAgentsByStage: vi.fn(() => [])
}))

vi.mock('../../services/agents/orchestrator', () => ({
  getOrchestrator: vi.fn()
}))

describe('AgentContext - Execution', () => {
  let mockOrchestrator

  beforeEach(() => {
    vi.clearAllMocks()

    mockOrchestrator = {
      getAllPipelines: vi.fn(() => []),
      executeAgent: vi.fn(),
      executePipeline: vi.fn(),
      cancelCurrentExecution: vi.fn()
    }

    orchestrator.getOrchestrator.mockReturnValue(mockOrchestrator)
  })

  describe('executeAgent', () => {
    test('throws error when no document initialized', async () => {
      let caughtError = null

      function ExecuteComponent() {
        const { executeAgent } = useAgents()

        const handleExecute = async () => {
          try {
            await executeAgent('test-agent')
          } catch (error) {
            caughtError = error
          }
        }

        return (
          <button onClick={handleExecute}>Execute</button>
        )
      }

      render(
        <AgentProvider>
          <ExecuteComponent />
        </AgentProvider>
      )

      screen.getByText('Execute').click()

      await waitFor(() => {
        expect(caughtError).not.toBeNull()
        expect(caughtError.message).toBe('No document initialized')
      })
    })

    test('sets isExecuting to true during execution', async () => {
      const user = userEvent.setup()

      mockOrchestrator.executeAgent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
      )

      function ExecuteComponent() {
        const { initializeDocument, executeAgent, isExecuting } = useAgents()

        return (
          <div>
            <span data-testid="executing">{isExecuting ? 'yes' : 'no'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executeAgent('test-agent')}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ExecuteComponent />
        </AgentProvider>
      )

      await user.click(screen.getByText('Initialize'))
      await user.click(screen.getByText('Execute'))

      // Should be executing
      await waitFor(() => {
        expect(screen.getByTestId('executing')).toHaveTextContent('yes')
      })

      // Should complete and set to false
      await waitFor(() => {
        expect(screen.getByTestId('executing')).toHaveTextContent('no')
      }, { timeout: 200 })
    })

    test('updates executionProgress during execution', async () => {
      const user = userEvent.setup()

      mockOrchestrator.executeAgent.mockResolvedValue({
        success: true,
        proposalsCount: 3
      })

      function ProgressComponent() {
        const { initializeDocument, executeAgent, executionProgress } = useAgents()

        return (
          <div>
            <span data-testid="status">{executionProgress?.status || 'none'}</span>
            <span data-testid="type">{executionProgress?.type || 'none'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executeAgent('test-agent')}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ProgressComponent />
        </AgentProvider>
      )

      await user.click(screen.getByText('Initialize'))
      await user.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('type')).toHaveTextContent('agent')
      })

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('completed')
      })
    })

    test('updates proposals after agent execution', async () => {
      const user = userEvent.setup()

      mockOrchestrator.executeAgent.mockResolvedValue({
        success: true,
        proposalsCount: 2
      })

      function ProposalsComponent() {
        const {
          initializeDocument,
          executeAgent,
          documentState,
          changeProposals
        } = useAgents()

        const executeWithProposals = async () => {
          await executeAgent('test-agent')
          // Add proposals to document state
          if (documentState) {
            documentState.addChangeProposal({
              type: 'replace',
              location: { start: 0, end: 4 },
              originalText: 'Test',
              proposedText: 'Updated',
              rationale: 'Better',
              category: 'style',
              priority: 'minor',
              agentId: 'test-agent'
            })
          }
        }

        return (
          <div>
            <span data-testid="proposals">{changeProposals.length}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={executeWithProposals}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ProposalsComponent />
        </AgentProvider>
      )

      await user.click(screen.getByText('Initialize'))
      await user.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(mockOrchestrator.executeAgent).toHaveBeenCalled()
      })
    })

    test('handles agent execution error', async () => {
      const user = userEvent.setup()

      mockOrchestrator.executeAgent.mockRejectedValue(new Error('Agent failed'))

      function ErrorComponent() {
        const { initializeDocument, executeAgent, executionProgress } = useAgents()

        return (
          <div>
            <span data-testid="status">{executionProgress?.status || 'none'}</span>
            <span data-testid="error">{executionProgress?.error || 'none'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executeAgent('test-agent').catch(() => {})}>
              Execute
            </button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ErrorComponent />
        </AgentProvider>
      )

      await user.click(screen.getByText('Initialize'))
      await user.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('failed')
        expect(screen.getByTestId('error')).toHaveTextContent('Agent failed')
      })
    })

    test('clears executionProgress after 3 seconds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      mockOrchestrator.executeAgent.mockResolvedValue({ success: true })

      function ProgressComponent() {
        const { initializeDocument, executeAgent, executionProgress } = useAgents()

        return (
          <div>
            <span data-testid="progress">{executionProgress ? 'yes' : 'no'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executeAgent('test-agent')}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ProgressComponent />
        </AgentProvider>
      )

      // Use fireEvent (not userEvent) with fake timers to avoid async timing conflicts
      fireEvent.click(screen.getByText('Initialize'))
      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveTextContent('yes')
      })

      // Fast-forward 3 seconds to trigger the setTimeout(() => setExecutionProgress(null), 3000)
      await vi.advanceTimersByTimeAsync(3000)

      await waitFor(() => {
        expect(screen.getByTestId('progress')).toHaveTextContent('no')
      })

      vi.useRealTimers()
    })
  })

  describe('executePipeline', () => {
    test('throws error when no document initialized', async () => {
      let caughtError = null

      function PipelineComponent() {
        const { executePipeline } = useAgents()

        const handleExecute = async () => {
          try {
            await executePipeline('test-pipeline')
          } catch (error) {
            caughtError = error
          }
        }

        return (
          <button onClick={handleExecute}>Execute</button>
        )
      }

      render(
        <AgentProvider>
          <PipelineComponent />
        </AgentProvider>
      )

      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(caughtError).not.toBeNull()
        expect(caughtError.message).toBe('No document initialized')
      })
    })

    test('sets isExecuting to true during pipeline execution', async () => {
      let resolveExecution
      mockOrchestrator.executePipeline.mockImplementation(
        () => new Promise(resolve => { resolveExecution = () => resolve({ status: 'completed' }) })
      )

      function PipelineComponent() {
        const { initializeDocument, executePipeline, isExecuting } = useAgents()

        return (
          <div>
            <span data-testid="executing">{isExecuting ? 'yes' : 'no'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executePipeline('test-pipeline').catch(() => {})}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <PipelineComponent />
        </AgentProvider>
      )

      fireEvent.click(screen.getByText('Initialize'))

      // Wait for state to settle after initialization
      await waitFor(() => {})

      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('executing')).toHaveTextContent('yes')
      })

      // Resolve the execution
      resolveExecution()

      await waitFor(() => {
        expect(screen.getByTestId('executing')).toHaveTextContent('no')
      })
    })

    test('passes callbacks to orchestrator', async () => {
      mockOrchestrator.executePipeline.mockResolvedValue({ status: 'completed' })

      function CallbackComponent() {
        const { initializeDocument, executePipeline } = useAgents()

        return (
          <div>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executePipeline('test-pipeline').catch(() => {})}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <CallbackComponent />
        </AgentProvider>
      )

      fireEvent.click(screen.getByText('Initialize'))

      await waitFor(() => {})

      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(mockOrchestrator.executePipeline).toHaveBeenCalledWith(
          'test-pipeline',
          expect.anything(),
          expect.objectContaining({
            onStepStart: expect.any(Function),
            onStepComplete: expect.any(Function),
            onProgress: expect.any(Function)
          })
        )
      })
    })

    test('updates currentStep during pipeline execution', async () => {
      mockOrchestrator.executePipeline.mockImplementation((id, doc, options) => {
        options.onStepStart(0, { agentId: 'agent-1' })
        return Promise.resolve({ status: 'completed' })
      })

      function StepComponent() {
        const { initializeDocument, executePipeline, currentStep } = useAgents()

        return (
          <div>
            <span data-testid="step">{currentStep ? 'yes' : 'no'}</span>
            <span data-testid="step-index">{currentStep?.stepIndex ?? 'none'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executePipeline('test-pipeline').catch(() => {})}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <StepComponent />
        </AgentProvider>
      )

      fireEvent.click(screen.getByText('Initialize'))

      await waitFor(() => {})

      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('step-index')).toHaveTextContent('0')
      })
    })

    test('clears currentStep after pipeline completion', async () => {
      mockOrchestrator.executePipeline.mockResolvedValue({ status: 'completed' })

      function StepComponent() {
        const { initializeDocument, executePipeline, currentStep } = useAgents()

        return (
          <div>
            <span data-testid="step">{currentStep ? 'yes' : 'no'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executePipeline('test-pipeline').catch(() => {})}>Execute</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <StepComponent />
        </AgentProvider>
      )

      fireEvent.click(screen.getByText('Initialize'))

      await waitFor(() => {})

      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('step')).toHaveTextContent('no')
      })
    })

    test('handles pipeline execution error', async () => {
      mockOrchestrator.executePipeline.mockRejectedValue(new Error('Pipeline failed'))

      function ErrorComponent() {
        const { initializeDocument, executePipeline, executionProgress } = useAgents()

        return (
          <div>
            <span data-testid="status">{executionProgress?.status || 'none'}</span>
            <span data-testid="error">{executionProgress?.error || 'none'}</span>
            <button onClick={() => initializeDocument('Test')}>Initialize</button>
            <button onClick={() => executePipeline('test-pipeline').catch(() => {})}>
              Execute
            </button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <ErrorComponent />
        </AgentProvider>
      )

      fireEvent.click(screen.getByText('Initialize'))

      await waitFor(() => {})

      fireEvent.click(screen.getByText('Execute'))

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('failed')
        expect(screen.getByTestId('error')).toHaveTextContent('Pipeline failed')
      })
    })
  })

  describe('cancelExecution', () => {
    test('calls orchestrator cancelCurrentExecution', () => {
      function CancelComponent() {
        const { cancelExecution } = useAgents()

        return <button onClick={cancelExecution}>Cancel</button>
      }

      render(
        <AgentProvider>
          <CancelComponent />
        </AgentProvider>
      )

      screen.getByText('Cancel').click()

      expect(mockOrchestrator.cancelCurrentExecution).toHaveBeenCalled()
    })

    test('sets isExecuting to false', () => {
      function CancelComponent() {
        const { cancelExecution, isExecuting } = useAgents()

        return (
          <div>
            <span data-testid="executing">{isExecuting ? 'yes' : 'no'}</span>
            <button onClick={cancelExecution}>Cancel</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <CancelComponent />
        </AgentProvider>
      )

      screen.getByText('Cancel').click()

      expect(screen.getByTestId('executing')).toHaveTextContent('no')
    })

    test('clears currentStep', () => {
      function CancelComponent() {
        const { cancelExecution, currentStep } = useAgents()

        return (
          <div>
            <span data-testid="step">{currentStep ? 'yes' : 'no'}</span>
            <button onClick={cancelExecution}>Cancel</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <CancelComponent />
        </AgentProvider>
      )

      screen.getByText('Cancel').click()

      expect(screen.getByTestId('step')).toHaveTextContent('no')
    })

    test('clears executionProgress', () => {
      function CancelComponent() {
        const { cancelExecution, executionProgress } = useAgents()

        return (
          <div>
            <span data-testid="progress">{executionProgress ? 'yes' : 'no'}</span>
            <button onClick={cancelExecution}>Cancel</button>
          </div>
        )
      }

      render(
        <AgentProvider>
          <CancelComponent />
        </AgentProvider>
      )

      screen.getByText('Cancel').click()

      expect(screen.getByTestId('progress')).toHaveTextContent('no')
    })
  })
})
