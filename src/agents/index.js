/**
 * Agent System - Index
 *
 * Central export for all agents and agent system components
 */

// Agent contracts
export { brainstormAgentContract, BRAINSTORM_AGENT_ID } from './brainstormAgent'
export { draftAgentContract, DRAFT_AGENT_ID } from './draftAgent'
export { revisionAgentContract, REVISION_AGENT_ID } from './revisionAgent'
export { editorAgentContract, EDITOR_AGENT_ID } from './editorAgent'
export { argumentStrengthenerAgentContract, ARGUMENT_STRENGTHENER_AGENT_ID } from './argumentStrengthenerAgent'

// Registry and core services
export {
  registerAgent,
  getAgent,
  getAllAgents,
  getAgentsByStage,
  AGENT_STAGES,
  OPERATION_TYPES,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES
} from '../services/agents/agentRegistry'

// Document state
export { DocumentState } from '../services/agents/documentState'

// Initialize and register all agents
import { brainstormAgentContract } from './brainstormAgent'
import { draftAgentContract } from './draftAgent'
import { revisionAgentContract } from './revisionAgent'
import { editorAgentContract } from './editorAgent'
import { argumentStrengthenerAgentContract } from './argumentStrengthenerAgent'
import { registerAgent } from '../services/agents/agentRegistry'

/**
 * Initialize the agent system by registering all agents
 */
export function initializeAgentSystem() {
  registerAgent(brainstormAgentContract)
  registerAgent(draftAgentContract)
  registerAgent(revisionAgentContract)
  registerAgent(editorAgentContract)
  registerAgent(argumentStrengthenerAgentContract)
}
