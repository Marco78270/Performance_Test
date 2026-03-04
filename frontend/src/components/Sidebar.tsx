import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Zap, LayoutDashboard, FileCode, History, Video,
  ShieldCheck, TrendingUp, Monitor, Calendar, Server,
  Settings, Sun, Moon, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react'
import './Sidebar.css'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  compact: boolean
  end?: boolean
}

function NavItem({ to, icon, label, compact, end }: NavItemProps) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
      title={compact ? label : undefined}>
      <span className="sidebar-nav-item__icon">{icon}</span>
      {!compact && <span className="sidebar-nav-item__label">{label}</span>}
    </NavLink>
  )
}

interface NavGroupProps {
  label: string
  compact: boolean
  children: React.ReactNode
}

function NavGroup({ label, compact, children }: NavGroupProps) {
  return (
    <div className="sidebar-group">
      {!compact && <span className="sidebar-group__label">{label}</span>}
      {compact && <div className="sidebar-group__separator" />}
      <nav className="sidebar-group__items" aria-label={label}>{children}</nav>
    </div>
  )
}

interface SidebarProps {
  appVersion: string
  theme: string
  onToggleTheme: () => void
  onLogout: () => void
}

export function Sidebar({ appVersion, theme, onToggleTheme, onLogout }: SidebarProps) {
  const [compact, setCompact] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(compact))
    document.documentElement.style.setProperty(
      '--sidebar-current-width',
      compact ? 'var(--sidebar-width-compact)' : 'var(--sidebar-width)'
    )
  }, [compact])

  const ICON_SIZE = 17

  return (
    <aside className={`sidebar ${compact ? 'sidebar--compact' : ''}`} aria-label="Navigation principale">
      {/* Logo + Toggle */}
      <div className="sidebar-header">
        {!compact && (
          <div className="sidebar-logo">
            <Zap size={18} className="sidebar-logo__icon" />
            <span className="sidebar-logo__text">GatlingWeb</span>
          </div>
        )}
        {compact && <Zap size={18} className="sidebar-logo__icon-alone" />}
        <button
          className="sidebar-toggle"
          onClick={() => setCompact(c => !c)}
          aria-label={compact ? 'Étendre la sidebar' : 'Réduire la sidebar'}
          title={compact ? 'Étendre' : 'Réduire'}
        >
          {compact ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        <NavGroup label="Gatling" compact={compact}>
          <NavItem to="/" icon={<LayoutDashboard size={ICON_SIZE} />} label="Dashboard" compact={compact} end />
          <NavItem to="/editor" icon={<FileCode size={ICON_SIZE} />} label="Éditeur" compact={compact} />
          <NavItem to="/history" icon={<History size={ICON_SIZE} />} label="Historique" compact={compact} />
          <NavItem to="/thresholds" icon={<ShieldCheck size={ICON_SIZE} />} label="Thresholds" compact={compact} />
          <NavItem to="/trends" icon={<TrendingUp size={ICON_SIZE} />} label="Tendances" compact={compact} />
          <NavItem to="/recorder" icon={<Video size={ICON_SIZE} />} label="Recorder" compact={compact} />
        </NavGroup>

        <NavGroup label="Selenium" compact={compact}>
          <NavItem to="/selenium" icon={<Monitor size={ICON_SIZE} />} label="Dashboard" compact={compact} end />
          <NavItem to="/selenium/editor" icon={<FileCode size={ICON_SIZE} />} label="Éditeur" compact={compact} />
          <NavItem to="/selenium/history" icon={<History size={ICON_SIZE} />} label="Historique" compact={compact} />
          <NavItem to="/selenium/trends" icon={<TrendingUp size={ICON_SIZE} />} label="Tendances" compact={compact} />
          <NavItem to="/selenium/config" icon={<Settings size={ICON_SIZE} />} label="Configuration" compact={compact} />
        </NavGroup>

        <NavGroup label="Système" compact={compact}>
          <NavItem to="/servers" icon={<Server size={ICON_SIZE} />} label="Serveurs" compact={compact} />
          <NavItem to="/scheduler" icon={<Calendar size={ICON_SIZE} />} label="Scheduler" compact={compact} />
          <NavItem to="/settings" icon={<Settings size={ICON_SIZE} />} label="Paramètres" compact={compact} />
        </NavGroup>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {appVersion && !compact && (
          <span className="sidebar-version">v{appVersion}</span>
        )}
        <div className="sidebar-footer__actions">
          <button
            className="sidebar-icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
            title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="sidebar-icon-btn sidebar-icon-btn--logout"
            onClick={onLogout}
            aria-label="Déconnexion"
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
        {!compact && (
          <button className="sidebar-logout-full" onClick={onLogout}>
            <LogOut size={14} />
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  )
}
