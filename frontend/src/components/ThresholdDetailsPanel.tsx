import type { ThresholdEvaluationResult } from '../api/testRunApi'

const METRIC_LABELS: Record<string, string> = {
  meanResponseTime: 'Mean Response Time',
  p50ResponseTime: 'p50 Response Time',
  p75ResponseTime: 'p75 Response Time',
  p95ResponseTime: 'p95 Response Time',
  p99ResponseTime: 'p99 Response Time',
  errorRate: 'Error Rate',
}

const OPERATOR_LABELS: Record<string, string> = {
  LT: '<',
  LTE: '<=',
  GT: '>',
  GTE: '>=',
}

interface Props {
  details: ThresholdEvaluationResult[]
  verdict: 'PASSED' | 'FAILED'
}

export default function ThresholdDetailsPanel({ details, verdict }: Props) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Threshold Evaluation</h3>
        <span className={`verdict-badge verdict-${verdict}`}>{verdict}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Threshold</th>
            <th>Actual</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {details.map((d, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{METRIC_LABELS[d.metric] || d.metric}</td>
              <td>{OPERATOR_LABELS[d.operator] || d.operator} {d.threshold}</td>
              <td style={{ color: d.passed ? '#27ae60' : '#e94560', fontWeight: 600 }}>
                {d.actual.toFixed(1)}
              </td>
              <td>
                {d.passed
                  ? <span style={{ color: '#27ae60' }}>PASS</span>
                  : <span style={{ color: '#e94560' }}>FAIL</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
