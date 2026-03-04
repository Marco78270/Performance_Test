import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import LoginForm from './components/LoginForm'
import { Sidebar } from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import HistoryPage from './pages/HistoryPage'
import TestMonitorPage from './pages/TestMonitorPage'
import RecorderPage from './pages/RecorderPage'
import ServersPage from './pages/ServersPage'
import ComparePage from './pages/ComparePage'
import ThresholdsPage from './pages/ThresholdsPage'
import TrendsPage from './pages/TrendsPage'
import SeleniumDashboardPage from './pages/SeleniumDashboardPage'
import SeleniumEditorPage from './pages/SeleniumEditorPage'
import SeleniumHistoryPage from './pages/SeleniumHistoryPage'
import SeleniumMonitorPage from './pages/SeleniumMonitorPage'
import SeleniumConfigPage from './pages/SeleniumConfigPage'
import SeleniumComparePage from './pages/SeleniumComparePage'
import SeleniumTrendsPage from './pages/SeleniumTrendsPage'
import SchedulerPage from './pages/SchedulerPage'
import SettingsPage from './pages/SettingsPage'
import { checkAuth, clearCredentials } from './api/auth'
import { useTheme } from './hooks/useTheme'
import './styles/design-tokens.css'
import './App.css'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [appVersion, setAppVersion] = useState('')
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    checkAuth().then(result => {
      setAuthenticated(result.authenticated)
      if (result.appVersion) setAppVersion(result.appVersion)
      setChecking(false)
    })
  }, [])

  useEffect(() => {
    const handleExpired = () => setAuthenticated(false)
    window.addEventListener('auth-expired', handleExpired)
    return () => window.removeEventListener('auth-expired', handleExpired)
  }, [])

  const handleLogout = () => {
    clearCredentials()
    setAuthenticated(false)
  }

  if (checking) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
      </div>
    )
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar
          appVersion={appVersion}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/test/:id" element={<TestMonitorPage />} />
              <Route path="/recorder" element={<RecorderPage />} />
              <Route path="/servers" element={<ServersPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/thresholds" element={<ThresholdsPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/selenium" element={<SeleniumDashboardPage />} />
              <Route path="/selenium/editor" element={<SeleniumEditorPage />} />
              <Route path="/selenium/history" element={<SeleniumHistoryPage />} />
              <Route path="/selenium/test/:id" element={<SeleniumMonitorPage />} />
              <Route path="/selenium/compare" element={<SeleniumComparePage />} />
              <Route path="/selenium/config" element={<SeleniumConfigPage />} />
              <Route path="/selenium/trends" element={<SeleniumTrendsPage />} />
              <Route path="/scheduler" element={<SchedulerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
