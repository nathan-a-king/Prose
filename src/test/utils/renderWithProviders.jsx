import { render } from '@testing-library/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AgentProvider } from '@/contexts/AgentContext'

/**
 * Render component with ThemeProvider
 */
export function renderWithTheme(ui, options = {}) {
  const { themeProps = {}, ...renderOptions } = options

  return render(
    <ThemeProvider {...themeProps}>
      {ui}
    </ThemeProvider>,
    renderOptions
  )
}

/**
 * Render component with AgentProvider
 */
export function renderWithAgents(ui, options = {}) {
  const { agentProps = {}, ...renderOptions } = options

  return render(
    <AgentProvider {...agentProps}>
      {ui}
    </AgentProvider>,
    renderOptions
  )
}

/**
 * Render component with all providers (Theme + Agent)
 */
export function renderWithAllProviders(ui, options = {}) {
  const { themeProps = {}, agentProps = {}, ...renderOptions } = options

  return render(
    <ThemeProvider {...themeProps}>
      <AgentProvider {...agentProps}>
        {ui}
      </AgentProvider>
    </ThemeProvider>,
    renderOptions
  )
}
