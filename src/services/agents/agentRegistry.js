/**
 * Agent Registry - Central registry of all editorial agents
 *
 * Each agent has:
 * - name: Unique identifier
 * - description: What the agent does
 * - allowedOperations: What the agent can do
 * - stage: Which pipeline stage it belongs to
 * - execute: The agent's main function
 */

export const AGENT_STAGES = {
  BRAINSTORM: 'brainstorm',
  DRAFT: 'draft',
  REVISE: 'revise',
  EDIT: 'edit',
  REVIEW: 'review'
}

export const OPERATION_TYPES = {
  READ: 'read',
  ANALYZE: 'analyze',
  PROPOSE_CHANGE: 'propose_change',
  GENERATE_CONTENT: 'generate_content'
}

export const CHANGE_TYPES = {
  REPLACE: 'replace',
  INSERT: 'insert',
  DELETE: 'delete',
  RESTRUCTURE: 'restructure',
  COMMENT: 'comment'
}

export const CHANGE_CATEGORIES = {
  STRUCTURE: 'structure',
  STYLE: 'style',
  MECHANICS: 'mechanics',
  LOGIC: 'logic',
  CONTENT: 'content'
}

export const CHANGE_PRIORITIES = {
  CRITICAL: 'critical',
  IMPORTANT: 'important',
  MINOR: 'minor'
}

/**
 * Agent Contract Interface
 *
 * @typedef {Object} AgentContract
 * @property {string} id - Unique agent ID
 * @property {string} name - Display name
 * @property {string} description - What the agent does
 * @property {string} stage - Pipeline stage
 * @property {string[]} allowedOperations - Operations this agent can perform
 * @property {Object} config - Agent-specific configuration
 * @property {Function} execute - Main agent function
 */

/**
 * Change Proposal Interface
 *
 * @typedef {Object} ChangeProposal
 * @property {string} id - Unique proposal ID
 * @property {string} type - Type of change (replace, insert, delete, restructure, comment)
 * @property {Object} location - Where the change applies
 * @property {number} location.start - Start position in document
 * @property {number} location.end - End position in document
 * @property {string} originalText - Original text (for replace/delete)
 * @property {string} proposedText - Proposed new text (for replace/insert)
 * @property {string} rationale - Why this change improves the document
 * @property {string} category - Category of change
 * @property {string} priority - Priority level
 * @property {string} agentId - Which agent proposed this
 * @property {string} status - pending | approved | rejected
 * @property {Date} createdAt - When proposed
 */

// Agent registry
const agents = new Map()

/**
 * Register an agent in the system
 */
export function registerAgent(agent) {
  if (!agent.id || !agent.name || !agent.execute) {
    throw new Error('Agent must have id, name, and execute function')
  }

  agents.set(agent.id, {
    ...agent,
    registeredAt: new Date()
  })

  console.log(`[AgentRegistry] Registered agent: ${agent.name} (${agent.id})`)
}

/**
 * Get an agent by ID
 */
export function getAgent(agentId) {
  return agents.get(agentId)
}

/**
 * Get all agents
 */
export function getAllAgents() {
  return Array.from(agents.values())
}

/**
 * Get agents by stage
 */
export function getAgentsByStage(stage) {
  return Array.from(agents.values()).filter(agent => agent.stage === stage)
}

/**
 * Unregister an agent
 */
export function unregisterAgent(agentId) {
  agents.delete(agentId)
}

/**
 * Clear all agents (for testing)
 */
export function clearAgents() {
  agents.clear()
}
