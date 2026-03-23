import { useState, useCallback } from 'react'

export const PANELS = {
  SIDEBAR: 'sidebar',
  AGENT: 'agent',
  PROPOSAL: 'proposal',
  SETTINGS: 'settings'
}

export function usePanelManager() {
  const [activePanel, setActivePanel] = useState(null)

  const togglePanel = useCallback((panel) => {
    setActivePanel(current => current === panel ? null : panel)
  }, [])

  const openPanel = useCallback((panel) => {
    setActivePanel(panel)
  }, [])

  const closePanel = useCallback(() => {
    setActivePanel(null)
  }, [])

  const isPanelOpen = useCallback((panel) => {
    return activePanel === panel
  }, [activePanel])

  return { activePanel, togglePanel, openPanel, closePanel, isPanelOpen, PANELS }
}
