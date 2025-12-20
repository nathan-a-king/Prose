/**
 * Brainstorm Agent
 *
 * Helps generate ideas, expand concepts, and explore creative directions.
 * Focuses on divergent thinking and possibility generation.
 */

import { makeCompletion } from '../services/agents/aiService'
import {
  AGENT_STAGES,
  OPERATION_TYPES,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES
} from '../services/agents/agentRegistry'

export const BRAINSTORM_AGENT_ID = 'brainstorm-agent'

export const brainstormAgentContract = {
  id: BRAINSTORM_AGENT_ID,
  name: 'Brainstorm Agent',
  description: 'Generates ideas, expands concepts, and explores creative directions for your writing',
  stage: AGENT_STAGES.BRAINSTORM,
  allowedOperations: [
    OPERATION_TYPES.READ,
    OPERATION_TYPES.ANALYZE,
    OPERATION_TYPES.GENERATE_CONTENT
  ],
  config: {
    model: 'gpt-4o',
    temperature: 0.9, // Higher temperature for creativity
    maxTokens: 4000
  },
  execute: executeBrainstormAgent
}

/**
 * Execute brainstorm agent
 */
async function executeBrainstormAgent(documentState, options = {}) {
  const {
    prompt = '',
    focusArea = 'general', // 'general', 'angles', 'structure', 'examples'
    count = 5,
    promptions = null
  } = options

  const content = documentState.getContent()
  const metadata = documentState.getMetadata()

  // Build system prompt
  let systemPrompt = buildSystemPrompt(focusArea)

  // Append promptions if available - CRITICAL: These override default behavior
  if (promptions && !promptions.isEmpty()) {
    const formatted = promptions.prettyPrintAsConversation()
    systemPrompt += `\n\n## CRITICAL: User-Configured Preferences
The user has explicitly configured the following preferences for this agent run.
You MUST strictly adhere to these settings. They override any default instructions above.

${formatted.question}

## User's Selected Configuration:
${formatted.answer}

IMPORTANT: Only perform the specific actions and corrections specified in the user's configuration above. Do not expand beyond these explicit instructions.`
  }

  // Build user prompt
  const userPrompt = buildUserPrompt({
    content,
    metadata,
    prompt,
    focusArea,
    count
  })

  try {
    // Call AI
    const response = await makeCompletion({
      systemPrompt,
      userPrompt,
      model: brainstormAgentContract.config.model,
      temperature: brainstormAgentContract.config.temperature,
      maxTokens: brainstormAgentContract.config.maxTokens,
      responseFormat: 'json'
    })

    // Parse response and create change proposals
    const proposals = parseResponse(response, documentState)

    // Add proposals to document state
    for (const proposal of proposals) {
      documentState.addChangeProposal(proposal)
    }

    // Add annotation with brainstorm results
    documentState.addAnnotation({
      agentId: BRAINSTORM_AGENT_ID,
      category: 'brainstorm',
      title: 'Brainstorming Results',
      content: `Generated ${proposals.length} ideas for ${focusArea}`,
      data: response
    })

    return {
      success: true,
      proposalsCreated: proposals.length,
      message: `Generated ${proposals.length} brainstorming ideas`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Build system prompt based on focus area
 */
function buildSystemPrompt(focusArea) {
  const basePrompt = `You are a creative brainstorming agent for writers. Your role is to help expand ideas, generate alternatives, and explore creative possibilities.

Return your response as a JSON object with this structure:
{
  "ideas": [
    {
      "title": "Brief title for the idea",
      "description": "Detailed explanation",
      "reasoning": "Why this is worth exploring"
    }
  ]
}

Be creative, divergent, and generative. This is the exploration phase - quantity over quality.`

  const focusPrompts = {
    general: 'Generate diverse ideas to expand and develop the content.',
    angles: 'Generate different angles or perspectives to approach this topic.',
    structure: 'Generate alternative ways to structure or organize this content.',
    examples: 'Generate specific examples, case studies, or illustrations for the concepts.',
    counterarguments: 'Generate potential counterarguments or objections to consider.',
    questions: 'Generate probing questions that would deepen the analysis.'
  }

  return `${basePrompt}\n\nFocus: ${focusPrompts[focusArea] || focusPrompts.general}`
}

/**
 * Build user prompt with document context
 */
function buildUserPrompt({ content, metadata, prompt, focusArea, count }) {
  let userPrompt = ''

  if (content && content.trim()) {
    userPrompt += `Current document:\n\n${content}\n\n`
  }

  if (prompt && prompt.trim()) {
    userPrompt += `User request: ${prompt}\n\n`
  }

  userPrompt += `Generate ${count} ${focusArea} ideas for this content.`

  return userPrompt
}

/**
 * Parse AI response into change proposals
 */
function parseResponse(response, documentState) {
  const proposals = []

  if (!response.ideas || !Array.isArray(response.ideas)) {
    console.error('Invalid brainstorm response format:', response)
    return proposals
  }

  const content = documentState.getContent()
  const endPosition = content.length

  for (const idea of response.ideas) {
    // Create a comment-type proposal for each idea
    proposals.push({
      type: CHANGE_TYPES.COMMENT,
      location: { start: endPosition, end: endPosition },
      originalText: '',
      proposedText: `\n\n## ${idea.title}\n\n${idea.description}`,
      rationale: idea.reasoning || 'Brainstorming idea to consider',
      category: CHANGE_CATEGORIES.CONTENT,
      priority: CHANGE_PRIORITIES.MINOR,
      agentId: BRAINSTORM_AGENT_ID,
      metadata: {
        ideaType: 'brainstorm',
        title: idea.title,
        description: idea.description
      }
    })
  }

  return proposals
}
