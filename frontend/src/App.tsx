import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'
import HistoryPage from './pages/HistoryPage'
import TestMonitorPage from './pages/TestMonitorPage'
import RecorderPage from './pages/RecorderPage'
import ServersPage from './pages/ServersPage'
import ComparePage from './pages/ComparePage'
import ThresholdsPage from './pages/ThresholdsPage'
import TrendsPage from './pages/TrendsPage'
import './App.css'

function App() {
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
