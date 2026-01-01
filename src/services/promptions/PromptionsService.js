import { basicOptionSet, BasicOptions } from '../../lib/promptions/basicOptions.js'
import { makeCompletion, makeStreamingCompletion } from '../agents/aiService.js'
import { getAgent } from '../agents/agentRegistry.js'

/**
 * Promptions Service - Generates contextual steering controls for AI agents
 *
 * This service acts as a bridge between Prose's agent system and the Promptions
 * dynamic option generation system. It uses an LLM to generate 2-4 relevant
 * controls based on agent context and document state.
 */
class PromptionsService {
  constructor() {
    this.basicOptionSet = basicOptionSet
  }

  /**
   * Generate agent-specific options via LLM
   * @param {string} agentId - Agent identifier
   * @param {DocumentState} documentState - Current document state
   * @returns {Promise<BasicOptions>} Generated options
   */
  async getOptionsForAgent(agentId, documentState) {
    const agent = getAgent(agentId)

    if (!agent) {
      console.error(`[PromptionsService] Agent not found: ${agentId}`)
      return this.basicOptionSet.emptyOptions()
    }

    try {
      console.log(`[PromptionsService] Generating options for agent: ${agent.name}`)

      const systemPrompt = this._buildSystemPrompt(agent, documentState)
      const userPrompt = 'Generate the steering controls as a JSON array.'

      // Use makeCompletion with JSON response format
      const content = await makeCompletion({
        systemPrompt,
        userPrompt,
        model: 'gpt-4o-mini', // Use cheaper model for option generation
        temperature: 0.7,
        maxTokens: 1000,
        responseFormat: 'text' // We'll extract JSON from markdown
      })

      console.log('[PromptionsService] Raw LLM response:', content)

      // Extract JSON from markdown code blocks if present
      const jsonString = this._extractJSON(content)
      console.log('[PromptionsService] Extracted JSON string:', jsonString)

      // Validate and parse the JSON
      const options = this.basicOptionSet.validateJSON(jsonString)
      console.log('[PromptionsService] Validated options:', options)

      if (options && !options.isEmpty()) {
        console.log(`[PromptionsService] Successfully generated ${options.options.length} controls`)
        return options
      } else {
        console.warn('[PromptionsService] Generated options were invalid, returning empty')
        console.warn('[PromptionsService] Raw content was:', content)
        console.warn('[PromptionsService] Extracted JSON was:', jsonString)
        return this.basicOptionSet.emptyOptions()
      }
    } catch (error) {
      console.error('[PromptionsService] Error generating options:', error)
      // Graceful fallback
      return this.basicOptionSet.emptyOptions()
    }
  }

  /**
   * Generate options with streaming for progressive rendering
   * @param {string} agentId - Agent identifier
   * @param {DocumentState} documentState - Current document state
   * @param {Function} onProgress - Callback for progressive updates
   * @returns {Promise<{options: BasicOptions, abort: Function|null}>} Final generated options and abort function
   */
  async getOptionsForAgentStreaming(agentId, documentState, onProgress) {
    const agent = getAgent(agentId)

    if (!agent) {
      console.error(`[PromptionsService] Agent not found: ${agentId}`)
      return {
        options: this.basicOptionSet.emptyOptions(),
        abort: null
      }
    }

    try {
      console.log(`[PromptionsService] Streaming options for agent: ${agent.name}`)

      const systemPrompt = this._buildSystemPrompt(agent, documentState)
      const userPrompt = 'Generate the steering controls as a JSON array.'

      let accumulated = ''

      const abort = await makeStreamingCompletion(
        {
          systemPrompt,
          userPrompt,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 1000
        },
        (chunk) => {
          accumulated += chunk

          // Try to validate partial JSON
          const jsonString = this._extractJSON(accumulated)
          const partialOptions = this.basicOptionSet.validatePartialJSON(jsonString)

          if (partialOptions && onProgress) {
            onProgress(partialOptions)
          }
        }
      )

      // Final validation
      const jsonString = this._extractJSON(accumulated)
      const finalOptions = this.basicOptionSet.validateJSON(jsonString)

      return {
        options: finalOptions || this.basicOptionSet.emptyOptions(),
        abort
      }
    } catch (error) {
      console.error('[PromptionsService] Error streaming options:', error)
      return {
        options: this.basicOptionSet.emptyOptions(),
        abort: null
      }
    }
  }

  /**
   * Refresh options based on current context
   * @param {string} agentId - Agent identifier
   * @param {BasicOptions} currentOptions - Current options
   * @param {DocumentState} documentState - Current document state
   * @returns {Promise<BasicOptions>} Refreshed options
   */
  async refreshOptions(agentId, currentOptions, documentState) {
    // For now, just regenerate options
    // Could be enhanced to preserve user selections while updating available choices
    return this.getOptionsForAgent(agentId, documentState)
  }

  /**
   * Format options for inclusion in agent prompt
   * @param {BasicOptions} options - Options to format
   * @returns {{ question: string, answer: string } | null}
   */
  formatOptionsForPrompt(options) {
    if (!options || options.isEmpty()) {
      return null
    }
    return options.prettyPrintAsConversation()
  }

  /**
   * Build system prompt for option generation
   * Includes agent context, document snippet, and schema specification
   * @private
   */
  _buildSystemPrompt(agent, documentState) {
    const schemaSpec = this.basicOptionSet.getSchemaSpec()
    const content = documentState.getContent()
    const contentSnippet = content.length > 500 ? content.substring(0, 500) + '...' : content

    return `You are generating steering controls for an AI writing agent.

**Agent Information:**
- Name: ${agent.name}
- Description: ${agent.description}
- Stage: ${agent.stage}

**Document Context:**
${contentSnippet}

**Your Task:**
Generate 3-5 contextually relevant steering controls that would be most useful for this specific agent operation. The controls should allow the user to steer the agent's behavior in meaningful ways.

Examples of good controls:
- For a Draft Agent: tone (formal/casual/playful), detail level (concise/moderate/detailed), include examples (yes/no), structure (linear/sections/bullet-points), length target (brief/medium/comprehensive)
- For a Revision Agent: focus area (structure/style/clarity/all), revision depth (light/moderate/heavy), preserve voice (yes/no), target audience (general/technical/academic), feedback style (direct/gentle/detailed)
- For an Edit Agent: correction types (grammar/spelling/punctuation/all), formality level (casual/neutral/formal), consistency checks (yes/no), style guide adherence (strict/flexible)

**Important Guidelines:**
1. Generate 3-5 controls (focused and relevant without overwhelming)
2. Make controls relevant to the specific agent and document context
3. Use clear, user-friendly labels
4. Provide meaningful options that actually affect agent behavior
5. Include a mix of single-select, multi-select, and binary-select controls
6. Return ONLY a JSON array, no explanatory text

**Output Format:**
Return a JSON array following this schema:

${schemaSpec}

**Example Output:**
\`\`\`json
[
  {
    "kind": "single-select",
    "label": "Writing Tone",
    "options": {
      "formal": "Formal",
      "neutral": "Neutral",
      "casual": "Casual"
    },
    "value": "neutral"
  },
  {
    "kind": "multi-select",
    "label": "Focus Areas",
    "options": {
      "structure": "Document Structure",
      "clarity": "Clarity & Readability",
      "examples": "Add Examples"
    },
    "value": ["clarity"]
  },
  {
    "kind": "binary-select",
    "label": "Preserve Author Voice",
    "options": {
      "enabled": "Keep the author's writing style",
      "disabled": "Allow style changes if needed"
    },
    "value": "enabled"
  }
]
\`\`\`

Now generate the controls.`
  }

  /**
   * Extract JSON from markdown code blocks
   * @private
   */
  _extractJSON(text) {
    // Try to extract from markdown code block first
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim()
    }

    // Try to find JSON array directly
    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      return arrayMatch[0]
    }

    // Return as-is and let validator handle it
    return text.trim()
  }
}

// Export singleton instance
export const promptionsService = new PromptionsService()
