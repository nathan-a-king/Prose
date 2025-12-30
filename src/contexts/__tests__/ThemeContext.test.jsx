import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../ThemeContext'

// Test component to access theme context
function TestComponent() {
  const { isDarkMode, toggleTheme, resetToSystemPreference } = useTheme()

  return (
    <div>
      <span data-testid="theme-value">{isDarkMode ? 'dark' : 'light'}</span>
      <button onClick={toggleTheme} data-testid="toggle-btn">
        Toggle
      </button>
      <button onClick={resetToSystemPreference} data-testid="reset-btn">
        Reset
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    localStorage.getItem.mockClear()
    localStorage.setItem.mockClear()
    localStorage.removeItem.mockClear()

    // Clear document classes
    document.documentElement.classList.remove('dark')
  })

  describe('ThemeProvider initialization', () => {
    test('initializes from localStorage when value exists (dark)', () => {
      localStorage.getItem.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
      expect(localStorage.getItem).toHaveBeenCalledWith('theme')
    })

    test('initializes from localStorage when value exists (light)', () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
    })

    test('falls back to system preference when localStorage empty (dark)', () => {
      localStorage.getItem.mockReturnValue(null)
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true // Dark mode
      }))

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
    })

    test('falls back to system preference when localStorage empty (light)', () => {
      localStorage.getItem.mockReturnValue(null)
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false // Light mode
      }))

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
    })

    test('handles invalid localStorage value', () => {
      localStorage.getItem.mockReturnValue('invalid-value')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Should default to light when value is not 'dark'
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
    })
  })

  describe('Dark mode class management', () => {
    test('adds dark class to document root when dark mode', () => {
      localStorage.getItem.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    test('removes dark class from document root when light mode', () => {
      localStorage.getItem.mockReturnValue('light')
      document.documentElement.classList.add('dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    test('updates dark class when theme changes', async () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(document.documentElement.classList.contains('dark')).toBe(false)

      await act(async () => {
        screen.getByTestId('toggle-btn').click()
      })

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('localStorage persistence', () => {
    test('saves dark theme to localStorage', () => {
      localStorage.getItem.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    })

    test('saves light theme to localStorage', () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light')
    })

    test('updates localStorage when theme changes', async () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      localStorage.setItem.mockClear()

      await act(async () => {
        screen.getByTestId('toggle-btn').click()
      })

      expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark')
    })
  })

  describe('toggleTheme', () => {
    test('switches from light to dark', async () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')

      await act(async () => {
        screen.getByTestId('toggle-btn').click()
      })

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
    })

    test('switches from dark to light', async () => {
      localStorage.getItem.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')

      await act(async () => {
        screen.getByTestId('toggle-btn').click()
      })

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
    })

    test('toggles multiple times correctly', async () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const toggleBtn = screen.getByTestId('toggle-btn')

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')

      await act(async () => {
        toggleBtn.click()
      })
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')

      await act(async () => {
        toggleBtn.click()
      })
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')

      await act(async () => {
        toggleBtn.click()
      })
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
    })
  })

  describe('resetToSystemPreference', () => {
    test('removes theme from localStorage', async () => {
      localStorage.getItem.mockReturnValue('dark')
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn()
      }))

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      await act(async () => {
        screen.getByTestId('reset-btn').click()
      })

      expect(localStorage.removeItem).toHaveBeenCalledWith('theme')
    })

    test('resets to system preference (dark)', async () => {
      localStorage.getItem.mockReturnValue('light')
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true // Dark mode system preference
      }))

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')

      await act(async () => {
        screen.getByTestId('reset-btn').click()
      })

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
    })

    test('resets to system preference (light)', async () => {
      localStorage.getItem.mockReturnValue('dark')
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false // Light mode system preference
      }))

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')

      await act(async () => {
        screen.getByTestId('reset-btn').click()
      })

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
    })

    test('updates dark class after reset', async () => {
      localStorage.getItem.mockReturnValue('dark')
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false // Light mode system preference
      }))

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(document.documentElement.classList.contains('dark')).toBe(true)

      await act(async () => {
        screen.getByTestId('reset-btn').click()
      })

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('useTheme hook', () => {
    test('throws error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useTheme must be used within a ThemeProvider')

      console.error = originalError
    })

    test('returns theme context when used inside ThemeProvider', () => {
      localStorage.getItem.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
      expect(screen.getByTestId('toggle-btn')).toBeInTheDocument()
      expect(screen.getByTestId('reset-btn')).toBeInTheDocument()
    })
  })

  describe('Multiple components using theme', () => {
    function AnotherComponent() {
      const { isDarkMode } = useTheme()
      return <div data-testid="another-theme">{isDarkMode ? 'dark' : 'light'}</div>
    }

    test('shares theme state across components', () => {
      localStorage.getItem.mockReturnValue('dark')

      render(
        <ThemeProvider>
          <TestComponent />
          <AnotherComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
      expect(screen.getByTestId('another-theme')).toHaveTextContent('dark')
    })

    test('updates all components when theme changes', async () => {
      localStorage.getItem.mockReturnValue('light')

      render(
        <ThemeProvider>
          <TestComponent />
          <AnotherComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
      expect(screen.getByTestId('another-theme')).toHaveTextContent('light')

      await act(async () => {
        screen.getByTestId('toggle-btn').click()
      })

      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
      expect(screen.getByTestId('another-theme')).toHaveTextContent('dark')
    })
  })
})
