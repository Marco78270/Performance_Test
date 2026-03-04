# GatlingWeb — Refonte UI & Corrections Bugs
**Date :** 2026-03-04
**Scope :** Bugs backend + Design System + Refonte graphique complète
**Priorité :** Bugs d'abord, puis refonte UI

---

## 1. Contexte

Le frontend comporte 18 pages (~6 300 lignes), 5 composants réutilisables, et un seul fichier CSS global (App.css, 498 lignes). Les composants ont été ajoutés au fur et à mesure sans design system cohérent, ce qui engendre :

- Couleurs dispersées (~30 valeurs hardcodées) dans App.css, les pages TSX et les composants Recharts
- Aucune librairie de composants — buttons, modals, inputs sont tous custom et inconsistants
- Emojis comme icônes (peu professionnel)
- Un seul breakpoint responsive (900px)
- Typographie non systématisée (0.7rem à 1.5rem sans échelle)
- États focus/hover faibles, accessibilité minimale

---

## 2. Décisions de Design

| Décision | Choix |
|----------|-------|
| Thème principal | Light épuré (style Datadog/Grafana Cloud) |
| Toggle dark/light | Conservé |
| Icônes | Lucide React (remplace emojis) |
| Navigation | Sidebar collapsible (240px ↔ 56px) avec groupes |
| Système CSS | CSS Variables étendues (design tokens) — pas de Tailwind |
| Librairie UI externe | Aucune — composants custom dans `components/ui/` |
| Ordre d'implémentation | Bugs backend → Design System → Composants UI → Pages |

---

## 3. Bugs Backend à Corriger (Phase 1)

### 3.1 WebSocketConfig — `.trim()` manquant
**Fichier :** `backend/src/main/java/com/gatlingweb/config/WebSocketConfig.java`
**Problème :** `allowedOrigins.split(",")` ne trim pas les espaces → mismatch possible
**Fix :** `Arrays.stream(origins.split(",")).map(String::trim).toArray(String[]::new)`

### 3.2 SimulationLogParser — Thread non géré + ArrayList non synchronisée
**Fichier :** `backend/src/main/java/com/gatlingweb/service/SimulationLogParser.java`
**Problèmes :**
- Thread créé directement via `new Thread(...)` sans ExecutorService
- `reservoir` est une `ArrayList` non thread-safe
**Fix :**
- Injecter un `ExecutorService` (single thread) géré par Spring
- Remplacer par `Collections.synchronizedList(new ArrayList<>())`

### 3.3 BandwidthLimiterService — Linux only
**Fichier :** `backend/src/main/java/com/gatlingweb/service/BandwidthLimiterService.java`
**Problème :** Utilise `tc` (Traffic Control Linux), crash silencieux sur Windows
**Fix :** Détecter `System.getProperty("os.name")`, désactiver proprement avec log explicite sur Windows

---

## 4. Design System (Phase 2)

### 4.1 Fichier de tokens — `design-tokens.css`

```css
:root {
  /* === COLORS === */
  --color-bg:        #F8FAFC;
  --color-surface:   #FFFFFF;
  --color-border:    #E2E8F0;
  --color-border-strong: #CBD5E1;

  --color-text:      #0F172A;
  --color-text-2:    #64748B;
  --color-text-3:    #94A3B8;

  --color-primary:   #2563EB;
  --color-primary-h: #1D4ED8;
  --color-primary-bg:#EFF6FF;

  --color-success:   #16A34A;
  --color-success-bg:#DCFCE7;
  --color-warning:   #D97706;
  --color-warning-bg:#FEF3C7;
  --color-error:     #DC2626;
  --color-error-bg:  #FEE2E2;
  --color-info:      #0284C7;
  --color-info-bg:   #E0F2FE;

  /* === SPACING (base 8px) === */
  --sp-1: 0.25rem;  /* 4px  */
  --sp-2: 0.5rem;   /* 8px  */
  --sp-3: 0.75rem;  /* 12px */
  --sp-4: 1rem;     /* 16px */
  --sp-5: 1.25rem;  /* 20px */
  --sp-6: 1.5rem;   /* 24px */
  --sp-8: 2rem;     /* 32px */

  /* === TYPOGRAPHY === */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.8125rem;  /* 13px */
  --text-base: 0.875rem;   /* 14px */
  --text-md:   1rem;       /* 16px */
  --text-lg:   1.25rem;    /* 20px */
  --text-xl:   1.5rem;     /* 24px */
  --text-2xl:  2rem;       /* 32px */

  /* === SHADOWS === */
  --shadow-sm: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04);
  --shadow-lg: 0 8px 32px rgba(0,0,0,.12);

  /* === RADIUS === */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* === TRANSITIONS === */
  --transition: 150ms ease;

  /* === SIDEBAR === */
  --sidebar-width: 240px;
  --sidebar-width-compact: 56px;
}

/* Dark mode */
[data-theme="dark"] {
  --color-bg:        #0F172A;
  --color-surface:   #1E293B;
  --color-border:    #334155;
  --color-border-strong: #475569;
  --color-text:      #F1F5F9;
  --color-text-2:    #94A3B8;
  --color-text-3:    #64748B;
  --color-primary-bg:#1E3A8A;
}
```

### 4.2 Palette graphiques Recharts (centralisée)

```typescript
// src/styles/chartColors.ts
export const CHART_COLORS = {
  primary:   '#2563EB',
  secondary: '#7C3AED',
  success:   '#16A34A',
  warning:   '#D97706',
  error:     '#DC2626',
  info:      '#0284C7',
  p50:       '#2563EB',
  p75:       '#7C3AED',
  p95:       '#D97706',
  p99:       '#DC2626',
  rps:       '#16A34A',
  users:     '#0284C7',
  errors:    '#DC2626',
} as const;

export const SERVER_TYPE_COLORS = {
  API:  '#2563EB',
  SQL:  '#7C3AED',
  WEB:  '#16A34A',
  FILE: '#D97706',
} as const;
```

---

## 5. Bibliothèque de Composants UI (Phase 3)

Emplacement : `frontend/src/components/ui/`

| Composant | Variants | Description |
|-----------|----------|-------------|
| `Button` | `primary / secondary / ghost / danger` × `sm/md/lg` | Remplace tous `.btn-*` |
| `Badge` | `success / warning / error / info / neutral` + prop `dot` | Status badges |
| `Card` | `default / elevated / flat` | Conteneur sections |
| `Input` | `default / error / disabled` + label + helperText | Inputs unifiés |
| `Select` | Idem Input + custom arrow SVG | Selects stylisés |
| `Modal` | Animation `fade + slide-up` (200ms) | Remplace modals custom |
| `Spinner` | `sm/md/lg` | Loading states |
| `Tooltip` | `top/bottom/left/right` | Remplace `title=""` HTML |
| `Alert` | `success / warning / error / info` | Remplace `<div style=...>` |
| `DataTable` | Hover rows, sort headers, pagination intégrée | Tables unifiées |
| `KpiCard` | Valeur + label + trend (↑↓=) + couleur état | KPI Dashboard |
| `ChartContainer` | Wrapper Recharts + theme auto | Plus de couleurs hardcodées |
| `PageHeader` | Title + description + actions slot | Header de page uniforme |
| `SectionTitle` | H2 de section avec separator | Titres de sections |

---

## 6. Navigation — Sidebar Collapsible (Phase 4)

### Structure des groupes

```
GATLING
  Dashboard    (/)
  Editor       (/editor)
  History      (/history)
  Trends       (/trends)
  Thresholds   (/thresholds)
  Recorder     (/recorder)

SELENIUM
  Dashboard    (/selenium)
  Editor       (/selenium/editor)
  History      (/selenium/history)
  Trends       (/selenium/trends)
  Config       (/selenium/config)

SYSTÈME
  Servers      (/servers)
  Scheduler    (/scheduler)
  Settings     (/settings)

FOOTER
  Toggle dark/light (icône Sun/Moon)
  Version badge (v2.6)
```

### Comportement collapsible
- Toggle via bouton `ChevronLeft/Right` en haut de sidebar
- Persisté dans `localStorage('sidebar-collapsed')`
- Mode compact : icônes seules 56px + Tooltip sur hover
- Transition CSS `width 200ms ease`
- `main-content` s'adapte via `margin-left` ou CSS Grid

---

## 7. Refonte des Pages (Phase 5)

### Pages prioritaires à refonter (dans l'ordre)

1. **Layout global** (Sidebar + App shell)
2. **DashboardPage** — KPI cards, recent runs table, launch form
3. **HistoryPage** — DataTable avec filtres, pagination, labels
4. **TestMonitorPage** — Charts temps réel, KPIs live, logs
5. **SeleniumMonitorPage** — Screenshots grid, video player, results
6. **ComparePage / SeleniumComparePage** — Charts superposés
7. **TrendsPage / SeleniumTrendsPage** — Tendances visuelles
8. **EditorPage / SeleniumEditorPage** — Monaco + arborescence
9. **ThresholdsPage / SchedulerPage / ServersPage / SettingsPage**

### Pattern commun pour chaque page

```tsx
<PageLayout>
  <PageHeader title="..." description="..." actions={<Button>...</Button>} />
  <section className="kpi-grid">
    <KpiCard value="2 431ms" label="p95 RT" trend="up" />
    ...
  </section>
  <Card>
    <DataTable ... />
  </Card>
</PageLayout>
```

---

## 8. Icônes Lucide (Phase 4 — avec Sidebar)

Mapping des emojis actuels → Lucide :

| Actuel | Lucide | Usage |
|--------|--------|-------|
| ⚡ | `Zap` | Logo sidebar |
| ☀️ / 🌙 | `Sun / Moon` | Toggle thème |
| ✏️ | `Pencil` | Éditer |
| ✕ | `X` | Fermer modal |
| ▶ | `Play` | Lancer test |
| ⏹ | `Square` | Stopper test |
| 📋 | `ClipboardList` | History |
| 📈 | `TrendingUp` | Trends |
| ⚙️ | `Settings` | Config |
| 🖥 | `Monitor` | Selenium |
| 🗓 | `Calendar` | Scheduler |
| 🖧 | `Server` | Servers |
| ⏺ | `Circle` (rouge) | REC video |
| + | `Plus` | Ajouter |
| ‹/› | `ChevronLeft/Right` | Navigation |

---

## 9. Corrections Accessibilité

- Focus visible sur tous les éléments interactifs (`outline: 2px solid var(--color-primary)`)
- `aria-label` sur tous les boutons icon-only
- Semantic HTML : `<nav>`, `<main>`, `<section>`, `<header>`
- Labels explicites sur tous les inputs (`<label htmlFor>`)
- Contraste minimum WCAG AA sur tous les textes

---

## 10. Ordre d'Implémentation Résumé

```
Phase 1 — Bugs Backend       (3 fixes isolés)
  ├─ WebSocketConfig.trim()
  ├─ SimulationLogParser ExecutorService + synchronizedList
  └─ BandwidthLimiterService Windows detection

Phase 2 — Design System      (0 UI cassée)
  ├─ design-tokens.css (remplace App.css variables)
  ├─ chartColors.ts
  └─ Inter font import

Phase 3 — Composants UI      (nouveaux fichiers)
  └─ components/ui/* (Button, Badge, Card, Input, Modal, etc.)

Phase 4 — Sidebar + Icônes   (App.tsx + Sidebar.tsx)
  ├─ lucide-react install
  ├─ Sidebar collapsible refonte
  └─ Remplacement emojis → Lucide

Phase 5 — Refonte des Pages  (page par page, sans casser l'existant)
  ├─ DashboardPage
  ├─ HistoryPage + SeleniumHistoryPage
  ├─ TestMonitorPage + SeleniumMonitorPage
  ├─ ComparePage x2 + TrendsPage x2
  ├─ EditorPage x2
  └─ ThresholdsPage + SchedulerPage + ServersPage + SettingsPage
```

---

## 11. Non-inclus dans ce scope

- Authentification JWT (fonctionnalité future distincte)
- Data retention / purge automatique (fonctionnalité future)
- Playwright support (fonctionnalité future)
- Docker (hors scope — environnement offline Windows)
- Notifications Slack/email (hors scope — réseau offline)
