# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refonte graphique complète de GatlingWeb vers un design light épuré professionnel (style Datadog/Grafana Cloud) avec sidebar collapsible, bibliothèque de composants unifiée et icônes Lucide.

**Architecture:** CSS Variables étendues (design-tokens.css) + composants UI dans `src/components/ui/` + sidebar extraite dans `Sidebar.tsx`. Migration progressive : le design system est posé en premier, les pages sont migrées une par une sans casser l'existant.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Recharts 3, lucide-react (à installer), CSS Variables

---

## Notes importantes

- **Bugs backend** : WebSocketConfig, SimulationLogParser et BandwidthLimiterService sont déjà corrects dans le code actuel — ne pas les modifier.
- **Aucun framework de test frontend** : vérification via `npm run build` (TypeScript) et `npm run lint` (ESLint). Pas de Vitest à ajouter.
- **Commandes de vérification** :
  - Frontend : `cd frontend && npm run build`
  - Lint : `cd frontend && npm run lint`
  - Dev : `cd frontend && npm run dev` (proxy → :8080)
- **Thème** : le défaut passe de `dark` à `light`. `[data-theme="dark"]` reste disponible via toggle.

---

## Phase 1 — Foundation

### Task 1: Installer lucide-react

**Files:**
- Modify: `frontend/package.json` (via npm)

**Step 1: Installer le package**

```bash
cd frontend && npm install lucide-react
```

**Step 2: Vérifier l'installation**

```bash
cd frontend && npm run build
```
Expected: BUILD SUCCESS (zéro erreur TypeScript)

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: install lucide-react for professional icons"
```

---

### Task 2: Créer le fichier design-tokens.css

**Files:**
- Create: `frontend/src/styles/design-tokens.css`
- Modify: `frontend/src/App.tsx` (ajouter import)

**Step 1: Créer le dossier styles**

```bash
mkdir frontend/src/styles
```

**Step 2: Créer `frontend/src/styles/design-tokens.css`**

```css
/* ============================================================
   DESIGN TOKENS — GatlingWeb
   Source de vérité pour couleurs, spacing, typographie, shadows.
   Importé AVANT App.css dans App.tsx.
   ============================================================ */

:root {
  /* === COULEURS — Light (défaut) === */
  --color-bg:              #F8FAFC;
  --color-surface:         #FFFFFF;
  --color-surface-raised:  #F1F5F9;
  --color-border:          #E2E8F0;
  --color-border-strong:   #CBD5E1;

  --color-text:            #0F172A;
  --color-text-2:          #64748B;
  --color-text-3:          #94A3B8;

  --color-primary:         #2563EB;
  --color-primary-hover:   #1D4ED8;
  --color-primary-active:  #1E40AF;
  --color-primary-bg:      #EFF6FF;
  --color-primary-border:  #BFDBFE;

  --color-success:         #16A34A;
  --color-success-bg:      #F0FDF4;
  --color-success-border:  #BBF7D0;

  --color-warning:         #D97706;
  --color-warning-bg:      #FFFBEB;
  --color-warning-border:  #FDE68A;

  --color-error:           #DC2626;
  --color-error-bg:        #FEF2F2;
  --color-error-border:    #FECACA;

  --color-info:            #0284C7;
  --color-info-bg:         #F0F9FF;
  --color-info-border:     #BAE6FD;

  /* === SPACING (base 8px) === */
  --sp-1:  0.25rem;   /*  4px */
  --sp-2:  0.5rem;    /*  8px */
  --sp-3:  0.75rem;   /* 12px */
  --sp-4:  1rem;      /* 16px */
  --sp-5:  1.25rem;   /* 20px */
  --sp-6:  1.5rem;    /* 24px */
  --sp-8:  2rem;      /* 32px */
  --sp-10: 2.5rem;    /* 40px */
  --sp-12: 3rem;      /* 48px */

  /* === TYPOGRAPHIE === */
  --font-family:   'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --text-xs:       0.75rem;    /* 12px */
  --text-sm:       0.8125rem;  /* 13px */
  --text-base:     0.875rem;   /* 14px */
  --text-md:       1rem;       /* 16px */
  --text-lg:       1.125rem;   /* 18px */
  --text-xl:       1.25rem;    /* 20px */
  --text-2xl:      1.5rem;     /* 24px */
  --text-3xl:      1.875rem;   /* 30px */

  /* === SHADOWS === */
  --shadow-xs: 0 1px 2px rgba(0,0,0,.04);
  --shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.04);
  --shadow-lg: 0 8px 32px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.06);

  /* === BORDER RADIUS === */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* === TRANSITIONS === */
  --transition-fast:   100ms ease;
  --transition:        150ms ease;
  --transition-slow:   250ms ease;

  /* === SIDEBAR === */
  --sidebar-width:         240px;
  --sidebar-width-compact: 56px;

  /* === STATUS COLORS (pour badges + recharts) === */
  --status-running-color:   #2563EB;
  --status-running-bg:      #EFF6FF;
  --status-completed-color: #16A34A;
  --status-completed-bg:    #F0FDF4;
  --status-failed-color:    #DC2626;
  --status-failed-bg:       #FEF2F2;
  --status-queued-color:    #D97706;
  --status-queued-bg:       #FFFBEB;
  --status-cancelled-color: #64748B;
  --status-cancelled-bg:    #F1F5F9;
}

/* === Dark mode === */
[data-theme="dark"] {
  --color-bg:              #0F172A;
  --color-surface:         #1E293B;
  --color-surface-raised:  #293548;
  --color-border:          #334155;
  --color-border-strong:   #475569;

  --color-text:            #F1F5F9;
  --color-text-2:          #94A3B8;
  --color-text-3:          #64748B;

  --color-primary-bg:      #1E3A8A;
  --color-primary-border:  #1D4ED8;

  --color-success-bg:      #052E16;
  --color-warning-bg:      #451A03;
  --color-error-bg:        #450A0A;
  --color-info-bg:         #0C2D4A;

  --shadow-sm: 0 1px 3px rgba(0,0,0,.20);
  --shadow-md: 0 4px 16px rgba(0,0,0,.30);
  --shadow-lg: 0 8px 32px rgba(0,0,0,.40);
}
```

**Step 3: Importer dans `frontend/src/App.tsx`** — ajouter en tête des imports CSS

```tsx
import './styles/design-tokens.css'
import './App.css'
```

**Step 4: Vérifier**

```bash
cd frontend && npm run build
```

**Step 5: Commit**

```bash
git add frontend/src/styles/design-tokens.css frontend/src/App.tsx
git commit -m "feat: add design tokens CSS (light-first color system)"
```

---

### Task 3: Créer chartColors.ts + mettre à jour App.css (thème light par défaut)

**Files:**
- Create: `frontend/src/styles/chartColors.ts`
- Modify: `frontend/src/App.css` (flip light/dark + refaire variables)
- Modify: `frontend/src/hooks/useTheme.ts` (défaut → 'light')

**Step 1: Créer `frontend/src/styles/chartColors.ts`**

```typescript
/** Palette centralisée pour tous les graphiques Recharts.
 *  Importer CHART_COLORS au lieu de hardcoder des couleurs dans les composants. */
export const CHART_COLORS = {
  primary:   '#2563EB',
  secondary: '#7C3AED',
  success:   '#16A34A',
  warning:   '#D97706',
  error:     '#DC2626',
  info:      '#0284C7',
  neutral:   '#64748B',
  // Percentiles
  p50:  '#2563EB',
  p75:  '#7C3AED',
  p95:  '#D97706',
  p99:  '#DC2626',
  // Métriques Gatling
  rps:    '#16A34A',
  eps:    '#DC2626',
  users:  '#0284C7',
  mean:   '#2563EB',
  // Métriques Selenium
  iterPerSec:    '#16A34A',
  stepDuration:  '#2563EB',
  browsers:      '#0284C7',
} as const

export const SERVER_TYPE_COLORS: Record<string, string> = {
  API:  '#2563EB',
  SQL:  '#7C3AED',
  WEB:  '#16A34A',
  FILE: '#D97706',
}

export const LABEL_COLORS = [
  '#2563EB', '#7C3AED', '#D97706', '#16A34A',
  '#0284C7', '#DC2626', '#059669', '#9333EA',
]

export function getLabelColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length]
}
```

**Step 2: Mettre à jour `frontend/src/hooks/useTheme.ts`** — changer le défaut de 'dark' à 'light'

```typescript
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  return { theme, toggleTheme }
}
```

**Step 3: Remplacer les variables dans `frontend/src/App.css`**

Remplacer le bloc `:root` et `[data-theme="light"]` en haut du fichier par :

```css
/* === Variables de compatibilité — mappées sur design-tokens.css === */
/* Ces variables sont conservées pour les pages non encore migrées. */
:root {
  --bg-primary:    var(--color-bg);
  --bg-secondary:  var(--color-surface);
  --bg-hover:      var(--color-surface-raised);
  --border-color:  var(--color-border);
  --accent:        var(--color-primary);
  --accent-hover:  var(--color-primary-hover);
  --input-bg:      var(--color-surface);
  --text-primary:  var(--color-text);
  --text-secondary:var(--color-text-2);
  --text-heading:  var(--color-text);
  --text-muted:    var(--color-text-3);
  --card-bg:       var(--color-surface);
  --tooltip-bg:    var(--color-surface);
}

/* Dark mode — les tokens sont déjà définis dans design-tokens.css */
[data-theme="dark"] {
  /* Les variables de compatibilité héritent automatiquement des tokens dark */
  --accent:        #6366F1;
  --accent-hover:  #4F46E5;
}
```

**Step 4: Mettre à jour la font dans App.css**

Trouver la règle `body` et mettre à jour :

```css
body {
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--text-base);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

**Step 5: Vérifier**

```bash
cd frontend && npm run build && npm run lint
```

**Step 6: Commit**

```bash
git add frontend/src/styles/chartColors.ts frontend/src/hooks/useTheme.ts frontend/src/App.css
git commit -m "feat: design tokens foundation - light theme default, chartColors centralized"
```

---

## Phase 2 — Bibliothèque de Composants UI

Tous les composants vont dans `frontend/src/components/ui/`.

### Task 4: Button component

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Button.css`

**Step 1: Créer `frontend/src/components/ui/Button.tsx`**

```tsx
import React from 'react'
import './Button.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${loading ? 'ui-btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {!loading && icon && iconPosition === 'left' && (
        <span className="ui-btn__icon">{icon}</span>
      )}
      {children && <span className="ui-btn__label">{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className="ui-btn__icon">{icon}</span>
      )}
    </button>
  )
}
```

**Step 2: Créer `frontend/src/components/ui/Button.css`**

```css
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-family);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition),
              color var(--transition), box-shadow var(--transition);
  white-space: nowrap;
  user-select: none;
  text-decoration: none;
}

.ui-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Sizes */
.ui-btn--sm  { padding: var(--sp-1) var(--sp-3); font-size: var(--text-sm);  }
.ui-btn--md  { padding: var(--sp-2) var(--sp-4); font-size: var(--text-base); }
.ui-btn--lg  { padding: var(--sp-3) var(--sp-6); font-size: var(--text-md);  }

/* Variants */
.ui-btn--primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.ui-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.ui-btn--secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}
.ui-btn--secondary:hover:not(:disabled) {
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
}

.ui-btn--ghost {
  background: transparent;
  color: var(--color-text-2);
  border-color: transparent;
}
.ui-btn--ghost:hover:not(:disabled) {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.ui-btn--danger {
  background: var(--color-error);
  color: #fff;
  border-color: var(--color-error);
}
.ui-btn--danger:hover:not(:disabled) {
  background: #B91C1C;
  border-color: #B91C1C;
}

/* States */
.ui-btn:disabled, .ui-btn--loading {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Icon */
.ui-btn__icon { display: flex; align-items: center; flex-shrink: 0; }

/* Spinner */
.ui-btn__spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
  flex-shrink: 0;
}
@keyframes btn-spin { to { transform: rotate(360deg); } }
```

**Step 3: Vérifier**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(ui): add Button component (primary/secondary/ghost/danger, sm/md/lg)"
```

---

### Task 5: Badge component

**Files:**
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Badge.css`

**Step 1: Créer `frontend/src/components/ui/Badge.tsx`**

```tsx
import './Badge.css'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'

interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', dot = false, children, className = '' }: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge--${variant} ${className}`}>
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Badge de status test (RUNNING, COMPLETED, FAILED, QUEUED, CANCELLED) */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    RUNNING:   'primary',
    COMPLETED: 'success',
    FAILED:    'error',
    QUEUED:    'warning',
    CANCELLED: 'neutral',
  }
  return (
    <Badge variant={map[status] ?? 'neutral'} dot={status === 'RUNNING'}>
      {status}
    </Badge>
  )
}
```

**Step 2: Créer `frontend/src/components/ui/Badge.css`**

```css
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 2px var(--sp-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.ui-badge--primary  { background: var(--color-primary-bg);  color: var(--color-primary);  border: 1px solid var(--color-primary-border);  }
.ui-badge--success  { background: var(--color-success-bg);  color: var(--color-success);  border: 1px solid var(--color-success-border);  }
.ui-badge--warning  { background: var(--color-warning-bg);  color: var(--color-warning);  border: 1px solid var(--color-warning-border);  }
.ui-badge--error    { background: var(--color-error-bg);    color: var(--color-error);    border: 1px solid var(--color-error-border);    }
.ui-badge--info     { background: var(--color-info-bg);     color: var(--color-info);     border: 1px solid var(--color-info-border);     }
.ui-badge--neutral  { background: var(--color-surface-raised); color: var(--color-text-2); border: 1px solid var(--color-border); }

.ui-badge__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: badge-pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

**Step 3: Vérifier**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(ui): add Badge + StatusBadge components"
```

---

### Task 6: Card component

**Files:**
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Card.css`

**Step 1: Créer `frontend/src/components/ui/Card.tsx`**

```tsx
import React from 'react'
import './Card.css'

interface CardProps {
  variant?: 'default' | 'elevated' | 'flat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

export function Card({ variant = 'default', padding = 'md', className = '', children }: CardProps) {
  return (
    <div className={`ui-card ui-card--${variant} ui-card--pad-${padding} ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="ui-card-header">
      <div className="ui-card-header__text">
        <h3 className="ui-card-header__title">{title}</h3>
        {description && <p className="ui-card-header__desc">{description}</p>}
      </div>
      {actions && <div className="ui-card-header__actions">{actions}</div>}
    </div>
  )
}
```

**Step 2: Créer `frontend/src/components/ui/Card.css`**

```css
.ui-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.ui-card--default  { box-shadow: var(--shadow-sm); }
.ui-card--elevated { box-shadow: var(--shadow-md); border-color: transparent; }
.ui-card--flat     { box-shadow: none; }

.ui-card--pad-none { padding: 0; }
.ui-card--pad-sm   { padding: var(--sp-3); }
.ui-card--pad-md   { padding: var(--sp-4) var(--sp-5); }
.ui-card--pad-lg   { padding: var(--sp-6) var(--sp-8); }

.ui-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-4);
}

.ui-card-header__title {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.ui-card-header__desc {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  margin: var(--sp-1) 0 0;
}

.ui-card-header__actions {
  display: flex;
  gap: var(--sp-2);
  flex-shrink: 0;
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(ui): add Card + CardHeader components"
```

---

### Task 7: Input + Select components

**Files:**
- Create: `frontend/src/components/ui/Input.tsx`
- Create: `frontend/src/components/ui/Input.css`

**Step 1: Créer `frontend/src/components/ui/Input.tsx`**

```tsx
import React from 'react'
import './Input.css'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  icon?: React.ReactNode
}

export function Input({ label, helperText, error, icon, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`ui-input-wrap ${error ? 'ui-input-wrap--error' : ''} ${className}`}>
      {label && <label className="ui-input-label" htmlFor={inputId}>{label}</label>}
      <div className="ui-input-field">
        {icon && <span className="ui-input-icon">{icon}</span>}
        <input id={inputId} className={`ui-input ${icon ? 'ui-input--with-icon' : ''}`} {...props} />
      </div>
      {error && <span className="ui-input-error" role="alert">{error}</span>}
      {!error && helperText && <span className="ui-input-helper">{helperText}</span>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  children: React.ReactNode
}

export function Select({ label, helperText, error, id, children, className = '', ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`ui-input-wrap ${error ? 'ui-input-wrap--error' : ''} ${className}`}>
      {label && <label className="ui-input-label" htmlFor={selectId}>{label}</label>}
      <div className="ui-select-field">
        <select id={selectId} className="ui-select" {...props}>{children}</select>
        <span className="ui-select-arrow" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
      {error && <span className="ui-input-error" role="alert">{error}</span>}
      {!error && helperText && <span className="ui-input-helper">{helperText}</span>}
    </div>
  )
}
```

**Step 2: Créer `frontend/src/components/ui/Input.css`**

```css
.ui-input-wrap { display: flex; flex-direction: column; gap: var(--sp-1); }

.ui-input-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}

.ui-input-field { position: relative; }

.ui-input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  font-family: var(--font-family);
  font-size: var(--text-base);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition), box-shadow var(--transition);
  outline: none;
}

.ui-input::placeholder { color: var(--color-text-3); }
.ui-input--with-icon  { padding-left: var(--sp-8); }

.ui-input:hover:not(:disabled) { border-color: var(--color-border-strong); }

.ui-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.ui-input:disabled {
  background: var(--color-surface-raised);
  color: var(--color-text-3);
  cursor: not-allowed;
}

.ui-input-wrap--error .ui-input {
  border-color: var(--color-error);
}
.ui-input-wrap--error .ui-input:focus {
  box-shadow: 0 0 0 3px var(--color-error-bg);
}

.ui-input-icon {
  position: absolute;
  left: var(--sp-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-3);
  pointer-events: none;
  display: flex;
}

/* Select */
.ui-select-field { position: relative; }

.ui-select {
  width: 100%;
  padding: var(--sp-2) var(--sp-8) var(--sp-2) var(--sp-3);
  font-family: var(--font-family);
  font-size: var(--text-base);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.ui-select:hover { border-color: var(--color-border-strong); }
.ui-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
}

.ui-select-arrow {
  position: absolute;
  right: var(--sp-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-3);
  pointer-events: none;
  display: flex;
}

.ui-input-error  { font-size: var(--text-xs); color: var(--color-error); }
.ui-input-helper { font-size: var(--text-xs); color: var(--color-text-3); }
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(ui): add Input + Select components with label/error/helper support"
```

---

### Task 8: Modal component

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`
- Create: `frontend/src/components/ui/Modal.css`

**Step 1: Créer `frontend/src/components/ui/Modal.tsx`**

```tsx
import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import './Modal.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, description, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="ui-modal-overlay" onClick={onClose} role="dialog" aria-modal aria-labelledby="modal-title">
      <div className={`ui-modal ui-modal--${size}`} onClick={e => e.stopPropagation()}>
        <div className="ui-modal-header">
          <div>
            <h2 id="modal-title" className="ui-modal-title">{title}</h2>
            {description && <p className="ui-modal-desc">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer" icon={<X size={16} />} />
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
```

**Step 2: Créer `frontend/src/components/ui/Modal.css`**

```css
.ui-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--sp-4);
  animation: modal-fade-in var(--transition-slow) ease;
}

@keyframes modal-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.ui-modal {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;
  animation: modal-slide-up var(--transition-slow) ease;
}

@keyframes modal-slide-up {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.ui-modal--sm { max-width: 400px; }
.ui-modal--md { max-width: 560px; }
.ui-modal--lg { max-width: 800px; }

.ui-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-5) var(--sp-6);
  border-bottom: 1px solid var(--color-border);
}

.ui-modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.ui-modal-desc {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  margin: var(--sp-1) 0 0;
}

.ui-modal-body {
  padding: var(--sp-5) var(--sp-6);
  overflow-y: auto;
  flex: 1;
}

.ui-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-6);
  border-top: 1px solid var(--color-border);
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(ui): add Modal component with animation and keyboard support"
```

---

### Task 9: KpiCard + PageHeader + Spinner + Alert components

**Files:**
- Create: `frontend/src/components/ui/KpiCard.tsx`
- Create: `frontend/src/components/ui/KpiCard.css`
- Create: `frontend/src/components/ui/PageHeader.tsx`
- Create: `frontend/src/components/ui/PageHeader.css`
- Create: `frontend/src/components/ui/Spinner.tsx`
- Create: `frontend/src/components/ui/Alert.tsx`
- Create: `frontend/src/components/ui/Alert.css`

**Step 1: Créer `frontend/src/components/ui/KpiCard.tsx`**

```tsx
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import './KpiCard.css'

type Trend = 'up' | 'down' | 'stable'
type KpiVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: Trend
  trendLabel?: string
  variant?: KpiVariant
}

export function KpiCard({ label, value, unit, trend, trendLabel, variant = 'default' }: KpiCardProps) {
  return (
    <div className={`ui-kpi ui-kpi--${variant}`}>
      <span className="ui-kpi__label">{label}</span>
      <div className="ui-kpi__value-row">
        <span className="ui-kpi__value">{value}</span>
        {unit && <span className="ui-kpi__unit">{unit}</span>}
      </div>
      {trend && (
        <div className={`ui-kpi__trend ui-kpi__trend--${trend}`}>
          {trend === 'up'     && <TrendingUp size={12} />}
          {trend === 'down'   && <TrendingDown size={12} />}
          {trend === 'stable' && <Minus size={12} />}
          {trendLabel && <span>{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Créer `frontend/src/components/ui/KpiCard.css`**

```css
.ui-kpi {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-4) var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  box-shadow: var(--shadow-sm);
}

.ui-kpi--success { border-left: 3px solid var(--color-success); }
.ui-kpi--warning { border-left: 3px solid var(--color-warning); }
.ui-kpi--error   { border-left: 3px solid var(--color-error);   }
.ui-kpi--info    { border-left: 3px solid var(--color-info);    }

.ui-kpi__label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ui-kpi__value-row {
  display: flex;
  align-items: baseline;
  gap: var(--sp-1);
}

.ui-kpi__value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
}

.ui-kpi__unit {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  font-weight: 500;
}

.ui-kpi__trend {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--text-xs);
  font-weight: 500;
}

.ui-kpi__trend--up     { color: var(--color-error);   }
.ui-kpi__trend--down   { color: var(--color-success);  }
.ui-kpi__trend--stable { color: var(--color-text-2);   }

/* Grid helper */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--sp-4);
  margin-bottom: var(--sp-6);
}
```

**Step 3: Créer `frontend/src/components/ui/PageHeader.tsx`**

```tsx
import React from 'react'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: string
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__main">
        {breadcrumb && <span className="ui-page-header__breadcrumb">{breadcrumb}</span>}
        <h1 className="ui-page-header__title">{title}</h1>
        {description && <p className="ui-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  )
}
```

**Step 4: Créer `frontend/src/components/ui/PageHeader.css`**

```css
.ui-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-6);
  padding-bottom: var(--sp-5);
  border-bottom: 1px solid var(--color-border);
}

.ui-page-header__breadcrumb {
  display: block;
  font-size: var(--text-xs);
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--sp-1);
}

.ui-page-header__title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  line-height: 1.2;
}

.ui-page-header__desc {
  font-size: var(--text-sm);
  color: var(--color-text-2);
  margin: var(--sp-1) 0 0;
}

.ui-page-header__actions {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  flex-shrink: 0;
  padding-top: var(--sp-1);
}
```

**Step 5: Créer `frontend/src/components/ui/Spinner.tsx`**

```tsx
import './Spinner.css'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  label?: string
}

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <div className={`ui-spinner ui-spinner--${size}`} role="status" aria-label={label ?? 'Chargement...'}>
      <div className="ui-spinner__ring" />
      {label && <span className="ui-spinner__label">{label}</span>}
    </div>
  )
}
```

**Créer `frontend/src/components/ui/Spinner.css`**

```css
.ui-spinner { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }

.ui-spinner__ring {
  border-radius: 50%;
  border-style: solid;
  border-color: var(--color-border);
  border-top-color: var(--color-primary);
  animation: spin 0.7s linear infinite;
}

.ui-spinner--sm .ui-spinner__ring { width: 16px; height: 16px; border-width: 2px; }
.ui-spinner--md .ui-spinner__ring { width: 28px; height: 28px; border-width: 3px; }
.ui-spinner--lg .ui-spinner__ring { width: 44px; height: 44px; border-width: 4px; }

.ui-spinner__label { font-size: var(--text-sm); color: var(--color-text-2); }

@keyframes spin { to { transform: rotate(360deg); } }
```

**Step 6: Créer `frontend/src/components/ui/Alert.tsx` + Alert.css**

```tsx
import React from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import './Alert.css'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  variant: AlertVariant
  title?: string
  children: React.ReactNode
}

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
  info:    Info,
}

export function Alert({ variant, title, children }: AlertProps) {
  const Icon = ICONS[variant]
  return (
    <div className={`ui-alert ui-alert--${variant}`} role="alert">
      <Icon size={16} className="ui-alert__icon" aria-hidden />
      <div className="ui-alert__body">
        {title && <strong className="ui-alert__title">{title}</strong>}
        <span className="ui-alert__text">{children}</span>
      </div>
    </div>
  )
}
```

```css
/* Alert.css */
.ui-alert {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  border: 1px solid;
  font-size: var(--text-sm);
}

.ui-alert--success { background: var(--color-success-bg); border-color: var(--color-success-border); color: var(--color-success); }
.ui-alert--warning { background: var(--color-warning-bg); border-color: var(--color-warning-border); color: var(--color-warning); }
.ui-alert--error   { background: var(--color-error-bg);   border-color: var(--color-error-border);   color: var(--color-error);   }
.ui-alert--info    { background: var(--color-info-bg);    border-color: var(--color-info-border);    color: var(--color-info);    }

.ui-alert__icon { flex-shrink: 0; margin-top: 1px; }
.ui-alert__body { display: flex; flex-direction: column; gap: 2px; }
.ui-alert__title { font-weight: 600; }
.ui-alert__text  { color: var(--color-text); }
```

**Step 7: Créer l'index d'exports `frontend/src/components/ui/index.ts`**

```typescript
export { Button } from './Button'
export { Badge, StatusBadge } from './Badge'
export { Card, CardHeader } from './Card'
export { Input, Select } from './Input'
export { Modal } from './Modal'
export { Spinner } from './Spinner'
export { Alert } from './Alert'
export { KpiCard } from './KpiCard'
export { PageHeader } from './PageHeader'
```

**Step 8: Vérifier**

```bash
cd frontend && npm run build && npm run lint
```

**Step 9: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat(ui): complete UI component library (KpiCard, PageHeader, Spinner, Alert)"
```

---

## Phase 3 — Sidebar Refonte

### Task 10: Extraire et refaire la Sidebar

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/Sidebar.css`
- Modify: `frontend/src/App.tsx` (utiliser Sidebar)
- Modify: `frontend/src/App.css` (supprimer styles sidebar)

**Step 1: Créer `frontend/src/components/Sidebar.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Zap, LayoutDashboard, FileCode, History, Video,
  ShieldCheck, TrendingUp, Monitor, Calendar, Server,
  Settings, Sun, Moon, LogOut, ChevronLeft, ChevronRight,
  FlaskConical
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
```

**Step 2: Créer `frontend/src/components/Sidebar.css`**

```css
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  flex-shrink: 0;
  transition: width var(--transition-slow);
  overflow: hidden;
}

.sidebar--compact { width: var(--sidebar-width-compact); }

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--color-border);
  min-height: 56px;
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  overflow: hidden;
}

.sidebar-logo__icon { color: var(--color-primary); flex-shrink: 0; }
.sidebar-logo__icon-alone { color: var(--color-primary); margin: 0 auto; }

.sidebar-logo__text {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.sidebar-toggle {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-2);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}

.sidebar-toggle:hover { background: var(--color-surface-raised); color: var(--color-text); }

/* Nav */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--sp-3) 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.sidebar-nav::-webkit-scrollbar { width: 4px; }
.sidebar-nav::-webkit-scrollbar-track { background: transparent; }
.sidebar-nav::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

/* Group */
.sidebar-group { margin-bottom: var(--sp-2); }

.sidebar-group__label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: var(--sp-2) var(--sp-4) var(--sp-1);
}

.sidebar-group__separator {
  height: 1px;
  background: var(--color-border);
  margin: var(--sp-2) var(--sp-3);
}

.sidebar-group__items { display: flex; flex-direction: column; }

/* NavItem */
.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-4);
  color: var(--color-text-2);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  border-radius: 0;
  transition: background var(--transition), color var(--transition);
  border-left: 2px solid transparent;
  white-space: nowrap;
}

.sidebar-nav-item:hover {
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.sidebar-nav-item--active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-left-color: var(--color-primary);
}

.sidebar-nav-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.sidebar--compact .sidebar-nav-item {
  justify-content: center;
  padding: var(--sp-2) 0;
  border-left: none;
  border-radius: 0;
}

.sidebar--compact .sidebar-nav-item--active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.sidebar-nav-item__icon { display: flex; flex-shrink: 0; }
.sidebar-nav-item__label { flex: 1; }

/* Footer */
.sidebar-footer {
  border-top: 1px solid var(--color-border);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  flex-shrink: 0;
}

.sidebar-version {
  font-size: var(--text-xs);
  color: var(--color-text-3);
  text-align: center;
}

.sidebar-footer__actions {
  display: flex;
  gap: var(--sp-2);
  justify-content: center;
}

.sidebar-icon-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-2);
  cursor: pointer;
  padding: var(--sp-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition), color var(--transition);
}

.sidebar-icon-btn:hover { background: var(--color-surface-raised); color: var(--color-text); }
.sidebar-icon-btn--logout:hover { background: var(--color-error-bg); color: var(--color-error); border-color: var(--color-error-border); }

.sidebar-logout-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-2);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
  font-family: var(--font-family);
}

.sidebar-logout-full:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
  border-color: var(--color-error-border);
}
```

**Step 3: Mettre à jour `frontend/src/App.tsx`**

Remplacer le contenu par :

```tsx
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
```

**Step 4: Mettre à jour App.css** — supprimer le bloc sidebar (maintenant dans Sidebar.css) et ajouter les classes app-level :

Trouver et remplacer le bloc `.sidebar { ... }` et tout ce qui le concerne (`.sidebar-title`, `.sidebar a`, `.sidebar-footer`, `.theme-toggle-btn`, `.logout-btn`, `.app-version`) par :

```css
/* App shell */
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--sp-6) var(--sp-8);
  background: var(--color-bg);
}

/* App loading */
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--color-bg);
}

.app-loading__spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
```

**Step 5: Vérifier**

```bash
cd frontend && npm run build && npm run lint
```

**Step 6: Test visuel**

```bash
cd frontend && npm run dev
```
Ouvrir http://localhost:5173 — vérifier :
- Sidebar light avec icônes Lucide
- Toggle compact (chevron gauche/droite)
- Groupes GATLING / SELENIUM / SYSTÈME
- Toggle dark/light fonctionnel

**Step 7: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/Sidebar.css frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: sidebar collapsible avec Lucide icons et groupes de navigation"
```

---

## Phase 4 — Refonte des Pages

**Principe pour chaque page :** utiliser `PageHeader`, `KpiCard`, `Card`, `Button`, `StatusBadge`, `Spinner`, `Alert` des nouveaux composants. Remplacer les styles inline par les classes du design system.

### Task 11: DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Pattern à appliquer :**

1. Remplacer le header `.page-title` par `<PageHeader title="Dashboard" actions={...} />`
2. Wrapper les statistiques en `<div className="kpi-grid"><KpiCard .../></div>`
3. Wrapper les sections en `<Card>` avec `<CardHeader>`
4. Remplacer les `.btn-primary` par `<Button variant="primary">`
5. Remplacer les `.loading-spinner` par `<Spinner label="Chargement..." />`
6. Remplacer les status badges par `<StatusBadge status={run.status} />`
7. Remplacer `<div style={{color:'#e94560'}}>` par `<Alert variant="error">`

Les imports à ajouter en haut :

```tsx
import { Button, Card, CardHeader, KpiCard, PageHeader, Spinner, Alert, StatusBadge } from '../components/ui'
import { Play, RefreshCw } from 'lucide-react'
import { CHART_COLORS } from '../styles/chartColors'
```

Vérifier : `npm run build`

Commit : `git commit -m "refactor(ui): DashboardPage — design system components"`

---

### Task 12: HistoryPage + SeleniumHistoryPage

**Files:**
- Modify: `frontend/src/pages/HistoryPage.tsx`
- Modify: `frontend/src/pages/SeleniumHistoryPage.tsx`

**Changements clés :**
- Appliquer `PageHeader` + `Card` + `Button` + `StatusBadge`
- Tables : ajouter classe `.data-table` dans App.css :

```css
/* DataTable */
.data-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.data-table th {
  padding: var(--sp-2) var(--sp-3);
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}
.data-table td {
  padding: var(--sp-3);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
}
.data-table tbody tr:hover { background: var(--color-primary-bg); }
.data-table tbody tr:last-child td { border-bottom: none; }
```

Remplacer les Recharts couleurs hardcodées par `CHART_COLORS.rps`, `CHART_COLORS.p95`, etc.

Vérifier + Commit : `git commit -m "refactor(ui): HistoryPage + SeleniumHistoryPage — design system"`

---

### Task 13: TestMonitorPage + SeleniumMonitorPage

**Files:**
- Modify: `frontend/src/pages/TestMonitorPage.tsx`
- Modify: `frontend/src/pages/SeleniumMonitorPage.tsx`

**Changements clés :**
- Header avec `PageHeader` + `StatusBadge` en `description` ou actions
- Métriques live en `<div className="kpi-grid"><KpiCard .../></div>`
- Charts : remplacer couleurs hardcodées par `CHART_COLORS`
- Sections en `<Card>`
- Bouton Stop → `<Button variant="danger" icon={<Square size={14}/>}>`

Vérifier + Commit : `git commit -m "refactor(ui): TestMonitorPage + SeleniumMonitorPage — design system"`

---

### Task 14: ComparePage + SeleniumComparePage

**Files:**
- Modify: `frontend/src/pages/ComparePage.tsx`
- Modify: `frontend/src/pages/SeleniumComparePage.tsx`

**Changements clés :**
- `PageHeader` avec breadcrumb "Gatling / Comparaison"
- Selector tests en `<Card>` avec `Input` pour les IDs
- Charts : `CHART_COLORS` centralisés
- Tableau récapitulatif → `.data-table`

Commit : `git commit -m "refactor(ui): ComparePage + SeleniumComparePage — design system"`

---

### Task 15: TrendsPage + SeleniumTrendsPage

**Files:**
- Modify: `frontend/src/pages/TrendsPage.tsx`
- Modify: `frontend/src/pages/SeleniumTrendsPage.tsx`

**Changements clés :**
- `PageHeader` + `Card` + `Select` pour choisir la simulation
- `CHART_COLORS` pour Recharts
- `StatusBadge` pour les verdicts thresholds

Commit : `git commit -m "refactor(ui): TrendsPage + SeleniumTrendsPage — design system"`

---

### Task 16: EditorPage + SeleniumEditorPage

**Files:**
- Modify: `frontend/src/pages/EditorPage.tsx`
- Modify: `frontend/src/pages/SeleniumEditorPage.tsx`

**Changements clés :**
- `PageHeader` avec actions (Save, New, Delete comme `Button`)
- Arborescence fichiers → `Card flat`
- Boutons de l'éditeur → `Button sm`
- Monaco garde son thème interne (ne pas changer)

Commit : `git commit -m "refactor(ui): EditorPage + SeleniumEditorPage — design system"`

---

### Task 17: ThresholdsPage + SchedulerPage + ServersPage + SettingsPage

**Files:**
- Modify: `frontend/src/pages/ThresholdsPage.tsx`
- Modify: `frontend/src/pages/SchedulerPage.tsx`
- Modify: `frontend/src/pages/ServersPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`

**Changements clés :**
- Chaque page : `PageHeader` + `Card` + `Button` + `Input`/`Select`
- Formulaires CRUD : `Modal` + `Input`/`Select` unifiés
- Icônes Lucide dans les boutons (Plus, Pencil, Trash2, Save)
- Remplacement de `<div style={{color:'red'}}>` par `<Alert variant="error">`

Commit : `git commit -m "refactor(ui): ThresholdsPage + SchedulerPage + ServersPage + SettingsPage"`

---

### Task 18: Nettoyage final App.css

**Files:**
- Modify: `frontend/src/App.css`

**Objectif :** Supprimer les règles CSS devenues inutiles après la migration des pages.

Après la migration de toutes les pages, identifier et supprimer :
- `.sidebar`, `.sidebar-title`, `.sidebar a`, `.sidebar-footer`, `.theme-toggle-btn`, `.logout-btn` → supprimé (dans Sidebar.css)
- `.status-RUNNING`, `.status-COMPLETED`, etc. → remplacés par Badge.css
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` → remplacés par Button.css
- `.modal-overlay`, `.modal` → remplacés par Modal.css
- `.loading-spinner` → remplacé par Spinner.css

Garder les règles spécifiques aux pages non encore couvertes par les composants.

Vérifier : `npm run build && npm run lint`

Commit :
```bash
git commit -m "chore: cleanup App.css - remove styles migrated to UI components"
```

---

### Task 19: Build final + vérification complète

**Step 1: Build frontend**

```bash
cd frontend && npm run build && npm run lint
```
Expected: 0 erreur TypeScript, 0 warning ESLint

**Step 2: Build complet backend**

```bash
cd backend && mvn package -DskipTests
```
Expected: BUILD SUCCESS

**Step 3: Test visuel**

Lancer `cd backend && mvn spring-boot:run` puis ouvrir http://localhost:8080.

Vérifier :
- Sidebar light avec groupes et icônes Lucide
- Toggle compact sidebar (stocké en localStorage)
- Toggle dark/light fonctionnel
- Toutes les pages affichent correctement
- KPI cards avec valeurs et trends
- Charts avec couleurs harmonisées
- Modals animées
- Boutons avec états hover/focus visibles

**Step 4: Commit final**

```bash
git add -A
git commit -m "feat: complete UI redesign v2.6 - light theme, design system, collapsible sidebar"
```

---

## Résumé des tâches

| # | Phase | Tâche | Temps estimé |
|---|-------|-------|--------------|
| 1 | Foundation | Install lucide-react | 2 min |
| 2 | Foundation | design-tokens.css | 10 min |
| 3 | Foundation | chartColors.ts + theme flip | 10 min |
| 4 | Composants | Button | 10 min |
| 5 | Composants | Badge + StatusBadge | 8 min |
| 6 | Composants | Card | 8 min |
| 7 | Composants | Input + Select | 12 min |
| 8 | Composants | Modal | 10 min |
| 9 | Composants | KpiCard + PageHeader + Spinner + Alert | 20 min |
| 10 | Sidebar | Sidebar collapsible + Lucide | 20 min |
| 11 | Pages | DashboardPage | 20 min |
| 12 | Pages | History x2 | 20 min |
| 13 | Pages | Monitor x2 | 25 min |
| 14 | Pages | Compare x2 | 15 min |
| 15 | Pages | Trends x2 | 15 min |
| 16 | Pages | Editor x2 | 15 min |
| 17 | Pages | Thresholds + Scheduler + Servers + Settings | 25 min |
| 18 | Cleanup | App.css nettoyage | 10 min |
| 19 | Final | Build + vérification | 10 min |
