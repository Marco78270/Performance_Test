import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import LoginForm from './components/LoginForm'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import HistoryPage from './pages/HistoryPage'
import TestMonitorPage from './pages/TestMonitorPage'
import RecorderPage from './pages/RecorderPage'
import ServersPage from './pages/ServersPage'
import ComparePage from './pages/ComparePage'
import ThresholdsPage from './pages/ThresholdsPage'
import TrendsPage from './pages/TrendsPage'
import { checkAuth, clearCredentials } from './api/auth'
import './App.css'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkAuth().then(ok => {
      setAuthenticated(ok)
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
    return <div className="login-container"><div className="loading-spinner">Checking authentication...</div></div>
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />
  }

  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-title">Gatling Web</div>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/editor">Editor</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/recorder">Recorder</NavLink>
          <NavLink to="/servers">Servers</NavLink>
          <NavLink to="/thresholds">Thresholds</NavLink>
          <NavLink to="/trends">Trends</NavLink>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </nav>
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
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
