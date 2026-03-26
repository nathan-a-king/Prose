import { createContext, useContext, useState, useEffect, useRef } from 'react'
import darkThemeHref from 'highlight.js/styles/atom-one-dark.css?url'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const darkThemeLinkRef = useRef(null)

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

  // Toggle highlight.js dark theme via a <link> element
  useEffect(() => {
    if (!darkThemeLinkRef.current) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = darkThemeHref
      link.id = 'hljs-dark-theme'
      link.disabled = !isDarkMode
      document.head.appendChild(link)
      darkThemeLinkRef.current = link
    } else {
      darkThemeLinkRef.current.disabled = !isDarkMode
    }
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