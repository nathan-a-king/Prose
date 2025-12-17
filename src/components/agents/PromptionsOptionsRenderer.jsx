import { useCallback } from 'react'
import { BasicOptions } from '../../lib/promptions/basicOptions.js'

/**
 * PromptionsOptionsRenderer - Renders options using Tailwind components
 * Supports all three control types: single-select, multi-select, binary-select
 */
export default function PromptionsOptionsRenderer({ options, onChange }) {
  if (!options || options.isEmpty()) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center border border-dashed border-gray-300 dark:border-neutral-600 rounded-lg">
        No configuration options for this agent
      </div>
    )
  }

  const handleControlChange = useCallback((index, newValue) => {
    const updated = [...options.options]
    updated[index] = { ...updated[index], value: newValue }
    onChange(new BasicOptions(updated))
  }, [options, onChange])

  return (
    <div className="space-y-4">
      {options.options.map((control, index) => {
        switch (control.kind) {
          case 'single-select':
            return (
              <SingleSelectControl
                key={index}
                control={control}
                onChange={(value) => handleControlChange(index, value)}
              />
            )
          case 'multi-select':
            return (
              <MultiSelectControl
                key={index}
                control={control}
                onChange={(value) => handleControlChange(index, value)}
              />
            )
          case 'binary-select':
            return (
              <BinaryControl
                key={index}
                control={control}
                onChange={(value) => handleControlChange(index, value)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}

/**
 * SingleSelectControl - Radio buttons for single selection
 */
function SingleSelectControl({ control, onChange }) {
  const selectedValue = Array.isArray(control.value) ? control.value[0] : control.value

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {control.label}
      </label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(control.options).map(([key, label]) => {
          const isSelected = selectedValue === key

          return (
            <label
              key={key}
              className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}
            >
              <input
                type="radio"
                name={`single-select-${control.label}`}
                value={key}
                checked={isSelected}
                onChange={() => onChange(key)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className={`text-sm ${
                isSelected
                  ? 'text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-700 dark:text-gray-200'
              }`}>
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * MultiSelectControl - Checkboxes for multiple selections
 */
function MultiSelectControl({ control, onChange }) {
  const selectedValues = Array.isArray(control.value) ? control.value : [control.value]

  const handleToggle = (key) => {
    const updated = selectedValues.includes(key)
      ? selectedValues.filter(v => v !== key)
      : [...selectedValues, key]
    onChange(updated)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
        {control.label}
      </label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(control.options).map(([key, label]) => {
          const isSelected = selectedValues.includes(key)

          return (
            <label
              key={key}
              className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(key)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2 rounded"
              />
              <span className={`text-sm ${
                isSelected
                  ? 'text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-700 dark:text-gray-200'
              }`}>
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/**
 * BinaryControl - Toggle switch for binary choice
 */
function BinaryControl({ control, onChange }) {
  const isEnabled = control.value === 'enabled'

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-800">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {control.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isEnabled ? control.options.enabled : control.options.disabled}
        </span>
      </div>
      <button
        onClick={() => onChange(isEnabled ? 'disabled' : 'enabled')}
        type="button"
        aria-label={`Toggle ${control.label}`}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            isEnabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
