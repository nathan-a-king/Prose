import * as z from 'zod'

// Zod schemas for validation
const multiOptionControl = z.object({
  kind: z.literal('multi-select'),
  label: z.string(),
  options: z.record(z.string()),
  value: z.union([z.string(), z.array(z.string())])
})

const singleOptionControl = z.object({
  kind: z.literal('single-select'),
  label: z.string(),
  options: z.record(z.string()),
  value: z.union([z.string(), z.tuple([z.string()])])
})

const binaryOptionControl = z.object({
  kind: z.literal('binary-select'),
  label: z.string(),
  options: z.object({
    enabled: z.string(),
    disabled: z.string()
  }),
  value: z.union([z.literal('enabled'), z.literal('disabled')])
})

const optionControl = z.union([multiOptionControl, singleOptionControl, binaryOptionControl])
const optionControlList = z.array(optionControl)

/**
 * BasicOptions class - represents a set of steering controls for AI agents
 * Ported from Promptions TypeScript implementation
 */
export class BasicOptions {
  constructor(options = []) {
    this.options = options
  }

  /**
   * Pretty print all options as human-readable text
   * @returns {string}
   */
  prettyPrint() {
    return this.options
      .map((control) => {
        if (control.kind === 'single-select') {
          const selectedValue = Array.isArray(control.value) ? control.value[0] : control.value
          const selectedLabel = control.options[selectedValue] || selectedValue
          return `Single Select: ${control.label} with options [${Object.keys(control.options).join(', ')}] - Selected: ${selectedLabel}`
        } else if (control.kind === 'binary-select') {
          const selectedValue = control.value
          const selectedLabel = control.options[selectedValue] || selectedValue
          return `Binary Select: ${control.label} with options [${Object.entries(control.options)
            .map(([key, label]) => `${key}: ${label}`)
            .join(', ')}] - Selected: ${selectedLabel}`
        } else {
          const selectedValues = Array.isArray(control.value) ? control.value : [control.value]
          const selectedLabels = selectedValues.map((val) => control.options[val] || val)
          return `Multi Select: ${control.label} with options [${Object.keys(control.options).join(', ')}] - Selected: ${selectedLabels.join(', ')}`
        }
      })
      .join('\n\n')
  }

  /**
   * Format options as a conversation (question and answer format)
   * @returns {{ question: string, answer: string }}
   */
  prettyPrintAsConversation() {
    const question = this.options
      .map((control) => {
        if (control.kind === 'single-select') {
          return `What is your choice for ${control.label}? Options are: ${Object.entries(control.options)
            .map(([key, label]) => `${key}: ${label}`)
            .join(', ')}`
        } else if (control.kind === 'binary-select') {
          return `What is your choice for ${control.label}? Options are: ${Object.entries(control.options)
            .map(([key, label]) => `${key}: ${label}`)
            .join(', ')}`
        } else {
          return `What are your choices for ${control.label}? Options are: ${Object.entries(control.options)
            .map(([key, label]) => `${key}: ${label}`)
            .join(', ')}`
        }
      })
      .join('\n')

    const answer = this.options
      .map((control) => {
        if (control.kind === 'single-select') {
          const selectedValue = Array.isArray(control.value) ? control.value[0] : control.value
          const selectedLabel = control.options[selectedValue] || selectedValue
          return `${control.label}: ${selectedLabel}`
        } else if (control.kind === 'binary-select') {
          const selectedValue = control.value
          const selectedLabel = control.options[selectedValue] || selectedValue
          return `${control.label}: ${selectedLabel}`
        } else {
          const selectedValues = Array.isArray(control.value) ? control.value : [control.value]
          const selectedLabels = selectedValues.map((val) => control.options[val] || val)
          return `${control.label}: ${selectedLabels.join(', ')}`
        }
      })
      .join('\n')

    return { question, answer }
  }

  /**
   * Merge updates into this options instance
   * @param {BasicOptions} update
   * @returns {BasicOptions}
   */
  mergeOptions(update) {
    const thisLen = this.options.length
    const mergedControls = [...this.options.slice(0, thisLen), ...update.options.slice(thisLen)]
    return new BasicOptions(mergedControls)
  }

  /**
   * Check if options list is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.options.length === 0
  }
}

// Schema specification string for LLMs
const schemaString = `\`\`\`typescript
interface SingleOptionControl {
  kind: "single-select";
  label: string;
  options: Record<string, string>;
  value: string;
}

interface MultiOptionControl {
  kind: "multi-select";
  label: string;
  options: Record<string, string>;
  value: string[]; // Must include at least one option
}

interface BinaryOptionControl {
  kind: "binary-select";
  label: string;
  options: {
    enabled: string; // Label for enabled state
    disabled: string; // Label for disabled state
  };
  value: "enabled" | "disabled"; // Must be either "enabled" or "disabled"
}

type OptionControl = SingleOptionControl | MultiOptionControl | BinaryOptionControl;

type OptionControlList = OptionControl[];
\`\`\``

/**
 * OptionSet implementation for BasicOptions
 * Handles validation, schema generation, and option management
 */
export const basicOptionSet = {
  /**
   * Get schema specification for LLM
   * @returns {string}
   */
  getSchemaSpec() {
    return schemaString
  },

  /**
   * Validate and parse JSON string into BasicOptions
   * @param {string} value - JSON string to validate
   * @returns {BasicOptions | undefined}
   */
  validateJSON(value) {
    try {
      console.log('[basicOptionSet] Starting validation...')
      const parsed = JSON.parse(value)
      console.log('[basicOptionSet] Parsed JSON:', parsed)
      console.log('[basicOptionSet] Type check:', Array.isArray(parsed), parsed.length)

      // Try to parse as the original format
      console.log('[basicOptionSet] Attempting Zod validation...')
      const originalResult = optionControlList.safeParse(parsed)
      console.log('[basicOptionSet] Zod result:', originalResult)

      if (originalResult.success) {
        console.log('[basicOptionSet] Validation SUCCESS!')
        return new BasicOptions(originalResult.data)
      } else {
        console.error('[basicOptionSet] Validation FAILED!')
        console.error('[basicOptionSet] Zod error:', originalResult.error)
        console.error('[basicOptionSet] Zod error formatted:', JSON.stringify(originalResult.error.format(), null, 2))
        console.error('[basicOptionSet] Failed data:', JSON.stringify(parsed, null, 2))
      }

      // If that fails, try to parse as the flattened JSON schema format
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.options)) {
        const transformedOptions = parsed.options.map((item) => {
          if (item.kind === 'binary-select') {
            return {
              kind: item.kind,
              label: item.label,
              options: {
                enabled: item.enabled_label || 'Yes',
                disabled: item.disabled_label || 'No'
              },
              value: item.selected_values[0] || 'disabled'
            }
          } else {
            // Convert flattened format back to our internal format
            const options = {}
            if (item.option_keys && item.option_values) {
              for (let i = 0; i < Math.min(item.option_keys.length, item.option_values.length); i++) {
                options[item.option_keys[i]] = item.option_values[i]
              }
            }

            return {
              kind: item.kind,
              label: item.label,
              options: options,
              value: item.kind === 'single-select' ? item.selected_values[0] : item.selected_values
            }
          }
        })

        const transformedResult = optionControlList.safeParse(transformedOptions)
        if (transformedResult.success) {
          return new BasicOptions(transformedResult.data)
        }
      }

      return undefined
    } catch (error) {
      return undefined
    }
  },

  /**
   * Incrementally validate partial JSON (for streaming)
   * @param {string} value - Partial JSON string
   * @returns {BasicOptions | undefined}
   */
  validatePartialJSON(value) {
    try {
      let jsonStr = value
      const arrayStart = jsonStr.indexOf('[')
      if (arrayStart === -1) return undefined

      jsonStr = jsonStr.substring(arrayStart)

      // Try parsing progressively from last complete object
      for (let i = jsonStr.lastIndexOf('},'); i >= 0; i = jsonStr.lastIndexOf('},', i - 1)) {
        const potentialJson = jsonStr.substring(0, i + 1) + ']'

        try {
          const parsed = JSON.parse(potentialJson)
          if (Array.isArray(parsed)) {
            const validated = basicOptionSet.validateJSON(JSON.stringify(parsed))
            if (validated) {
              return validated
            }
          }
        } catch {
          continue
        }
      }

      // Try completing the JSON
      const completeJsonAttempts = [jsonStr, jsonStr + ']', jsonStr.replace(/,\s*$/, '') + ']']

      for (const attempt of completeJsonAttempts) {
        try {
          const parsed = JSON.parse(attempt)
          if (Array.isArray(parsed)) {
            const validated = basicOptionSet.validateJSON(JSON.stringify(parsed))
            if (validated) {
              return validated
            }
          }
        } catch {
          continue
        }
      }
      return undefined
    } catch (error) {
      return undefined
    }
  },

  /**
   * Create empty options instance
   * @returns {BasicOptions}
   */
  emptyOptions() {
    return new BasicOptions([])
  },

  /**
   * Merge two BasicOptions instances
   * @param {BasicOptions} base
   * @param {BasicOptions} update
   * @returns {BasicOptions}
   */
  mergeOptions(base, update) {
    return base.mergeOptions(update)
  }
}
