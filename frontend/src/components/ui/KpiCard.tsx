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
