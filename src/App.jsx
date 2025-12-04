import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AgentProvider } from './contexts/AgentContext'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'

function App() {
  return (
    <ThemeProvider>
      <AgentProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
            </Routes>
          </Layout>
        </Router>
      </AgentProvider>
    </ThemeProvider>
  )
}

export default App