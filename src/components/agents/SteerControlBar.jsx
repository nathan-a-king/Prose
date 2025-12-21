import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MODE_CONFIG = {
  draft: {
    label: 'Draft',
    description: 'Generate or expand new material with the writer\'s goals in mind.',
    defaults: {
      tone: 'neutral',
      density: 55,
      risk: 35,
      preserveVoice: true,
      safeRewrite: false
    },
    toneOptions: [
      { value: 'neutral', label: 'Neutral' },
      { value: 'encouraging', label: 'Encouraging' },
      { value: 'playful', label: 'Playful' },
      { value: 'bold', label: 'Bold' }
    ],
    densityLabel: 'Idea density',
    riskLabel: 'Exploration'
  },
  revise: {
    label: 'Revise',
    description: 'Reshape or restructure the existing draft without losing intent.',
    defaults: {
      tone: 'confident',
      density: 45,
      risk: 45,
      preserveVoice: true,
      safeRewrite: true
    },
    toneOptions: [
      { value: 'confident', label: 'Confident' },
      { value: 'analytical', label: 'Analytical' },
      { value: 'warm', label: 'Warm' },
      { value: 'direct', label: 'Direct' }
    ],
    densityLabel: 'Edit depth',
    riskLabel: 'Risk tolerance'
  },
  edit: {
    label: 'Edit',
    description: 'Polish and correct with a light but precise touch.',
    defaults: {
      tone: 'precise',
      density: 30,
      risk: 20,
      preserveVoice: true,
      safeRewrite: true
    },
    toneOptions: [
      { value: 'precise', label: 'Precise' },
      { value: 'formal', label: 'Formal' },
      { value: 'friendly', label: 'Friendly' },
      { value: 'concise', label: 'Concise' }
    ],
    densityLabel: 'Change density',
    riskLabel: 'Safety'
  }
}

function getDefaultState(mode = 'draft') {
  const config = MODE_CONFIG[mode]
  return {
    mode,
    ...config.defaults
  }
}

export default function SteerControlBar({ onChange }) {
  const [state, setState] = useState(() => getDefaultState())
  const [whyOpen, setWhyOpen] = useState(false)
  const lastSliderChange = useRef(null)

  const config = MODE_CONFIG[state.mode]

  const emitChange = useCallback((nextState, meta) => {
    if (onChange) {
      onChange(nextState, meta)
    }
  }, [onChange])

  useEffect(() => {
    emitChange(state, { source: 'init', immediate: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!lastSliderChange.current) return
    const source = lastSliderChange.current
    const timer = setTimeout(() => {
      emitChange(state, { source, debounced: true, delayMs: 250 })
      lastSliderChange.current = null
    }, 250)

    return () => clearTimeout(timer)
  }, [state.density, state.risk, emitChange])

  const isDirty = useCallback((key) => {
    const defaults = MODE_CONFIG[state.mode].defaults
    return state[key] !== defaults[key]
  }, [state])

  const handleModeChange = (mode) => {
    const next = getDefaultState(mode)
    lastSliderChange.current = null
    setState(next)
    emitChange(next, { source: 'mode', immediate: true })
  }

  const handleSelectChange = (key, value) => {
    const next = { ...state, [key]: value }
    setState(next)
    emitChange(next, { source: key, immediate: true })
  }

  const handleSliderChange = (key, value) => {
    lastSliderChange.current = key
    setState(prev => ({ ...prev, [key]: Number(value) }))
  }

  const handleToggle = (key) => {
    const next = { ...state, [key]: !state[key] }
    setState(next)
    emitChange(next, { source: key, immediate: true })
  }

  const handleReset = () => {
    const next = getDefaultState(state.mode)
    lastSliderChange.current = null
    setState(next)
    emitChange(next, { source: 'reset', immediate: true })
  }

  const modifierString = useMemo(() => {
    const toneLabel = config.toneOptions.find(t => t.value === state.tone)?.label || state.tone
    const parts = [
      `Mode: ${config.label} — ${config.description}`,
      `Tone: ${toneLabel}`,
      `${config.densityLabel}: ${state.density}%`,
      `${config.riskLabel}: ${state.risk}%`,
      state.preserveVoice ? 'Preserve the author\'s voice.' : 'Feel free to shift the voice to suit the goal.',
      state.safeRewrite
        ? 'Apply safe rewrite safeguards: avoid hallucinations, keep facts and formatting intact.'
        : 'Allow bolder rewrites when useful, even if it requires restructuring.'
    ]

    return parts.join(' ')
  }, [config, state.density, state.preserveVoice, state.risk, state.safeRewrite, state.tone])

  const hasDirtyControls = useMemo(() => {
    const defaults = MODE_CONFIG[state.mode].defaults
    return Object.keys(defaults).some(key => state[key] !== defaults[key])
  }, [state])

  return (
    <div className="w-full bg-white dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-neutral-600 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Steer this pass</p>
          <p className="text-sm text-gray-700 dark:text-gray-200">Align Promptions controls with the pass you are about to run.</p>
        </div>
        <button
          onClick={handleReset}
          disabled={!hasDirtyControls}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-200 dark:border-neutral-500 text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(MODE_CONFIG).map(([mode, modeConfig]) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                state.mode === mode
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'border-gray-200 dark:border-neutral-500 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{modeConfig.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{modeConfig.description.split(' ')[0]}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <span>Tone</span>
              {isDirty('tone') && <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true"></span>}
            </div>
            <select
              value={state.tone}
              onChange={(e) => handleSelectChange('tone', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
            >
              {config.toneOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <div className="flex items-center gap-2">
                <span>{config.densityLabel}</span>
                {isDirty('density') && <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true"></span>}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{state.density}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.density}
              onChange={(e) => handleSliderChange('density', e.target.value)}
              className="w-full accent-blue-600"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <div className="flex items-center gap-2">
                <span>{config.riskLabel}</span>
                {isDirty('risk') && <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true"></span>}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{state.risk}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.risk}
              onChange={(e) => handleSliderChange('risk', e.target.value)}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ToggleRow
            label="Preserve voice"
            dirty={isDirty('preserveVoice')}
            value={state.preserveVoice}
            onToggle={() => handleToggle('preserveVoice')}
            description="Keep the writer's cadence, POV, and diction intact."
          />
          <ToggleRow
            label="Safe rewrite"
            dirty={isDirty('safeRewrite')}
            value={state.safeRewrite}
            onToggle={() => handleToggle('safeRewrite')}
            description="Prefer conservative edits and avoid risky rewrites."
          />
        </div>

        <details className="group border border-gray-200 dark:border-neutral-600 rounded-lg">
          <summary
            className="flex items-center justify-between px-3 py-2 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
            onClick={(e) => {
              e.preventDefault()
              setWhyOpen(v => !v)
            }}
          >
            <div className="flex items-center gap-2">
              <span>Why did it change?</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">See the exact modifier string</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${whyOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          {whyOpen && (
            <div className="px-3 pb-3 text-sm text-gray-700 dark:text-gray-100 leading-relaxed">
              <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg p-3 whitespace-pre-wrap">
                {modifierString}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">This is the full control string you can send alongside the regenerate call.</p>
            </div>
          )}
        </details>
      </div>
    </div>
  )
}

function ToggleRow({ label, value, dirty, onToggle, description }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 border border-gray-200 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-800">
      <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {dirty && <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true"></span>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
