import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  // Dynamically load highlight.js theme based on mode
  useEffect(() => {
    const loadHighlightTheme = async () => {
      if (isDarkMode) {
        await import('highlight.js/styles/atom-one-dark.css')
      }
      // Light theme is already imported in index.css, no need to import again
    }
    loadHighlightTheme()
  }, [isDarkMode])

  const toggleTheme = () => setIsDarkMode(!isDarkMode)

  const resetToSystemPreference = () => {
    localStorage.removeItem('theme')
    setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, resetToSystemPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}