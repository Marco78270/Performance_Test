import { useState, useEffect } from 'react'
import {
  fetchThresholdProfiles, createThresholdProfile, updateThresholdProfile, deleteThresholdProfile,
  type ThresholdProfile, type ThresholdRule, type CreateThresholdProfileRequest,
} from '../api/thresholdApi'
import { fetchSimulationClasses } from '../api/simulationApi'

const METRICS = [
  { value: 'meanResponseTime', label: 'Mean Response Time (ms)' },
  { value: 'p50ResponseTime', label: 'p50 Response Time (ms)' },
  { value: 'p75ResponseTime', label: 'p75 Response Time (ms)' },
  { value: 'p95ResponseTime', label: 'p95 Response Time (ms)' },
  { value: 'p99ResponseTime', label: 'p99 Response Time (ms)' },
  { value: 'errorRate', label: 'Error Rate (%)' },
]

const OPERATORS = [
  { value: 'LT', label: '< Less than' },
  { value: 'LTE', label: '<= Less or equal' },
  { value: 'GT', label: '> Greater than' },
  { value: 'GTE', label: '>= Greater or equal' },
]

function emptyRule(): ThresholdRule {
  return { metric: 'p95ResponseTime', operator: 'LT', value: 500, label: 'p95 < 500ms' }
}

export default function ThresholdsPage() {
  const [profiles, setProfiles] = useState<ThresholdProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<string[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ThresholdProfile | null>(null)
  const [error, setError] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formClass, setFormClass] = useState('')
  const [formRules, setFormRules] = useState<ThresholdRule[]>([emptyRule()])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [profilesResult, classesResult] = await Promise.allSettled([
        fetchThresholdProfiles(),
        fetchSimulationClasses(),
      ])
      if (profilesResult.status === 'fulfilled') {
        setProfiles(profilesResult.value)
      }
      if (classesResult.status === 'fulfilled') {
        setClasses(classesResult.value)
      }
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setFormName('')
    setFormClass(classes[0] || '')
    setFormRules([emptyRule()])
    setError('')
    setModalOpen(true)
  }

  function openEdit(profile: ThresholdProfile) {
    setEditing(profile)
    setFormName(profile.name)
    setFormClass(profile.simulationClass)
    setFormRules(profile.rules.length > 0 ? [...profile.rules] : [emptyRule()])
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    const request: CreateThresholdProfileRequest = {
      name: formName,
      simulationClass: formClass,
      rules: formRules.filter(r => r.metric && r.operator),
    }
    try {
      if (editing) {
        await updateThresholdProfile(editing.id, request)
      } else {
        await createThresholdProfile(request)
      }
      setModalOpen(false)
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this threshold profile?')) return
    await deleteThresholdProfile(id)
    await loadData()
  }

  function updateRule(index: number, updates: Partial<ThresholdRule>) {
    setFormRules(prev => prev.map((r, i) => {
      if (i !== index) return r
      const updated = { ...r, ...updates }
      // Auto-generate label
      const metricLabel = METRICS.find(m => m.value === updated.metric)?.label || updated.metric
      const opLabel = updated.operator === 'LT' ? '<' : updated.operator === 'LTE' ? '<=' : updated.operator === 'GT' ? '>' : '>='
      updated.label = `${metricLabel} ${opLabel} ${updated.value}`
      return updated
    }))
  }

  function removeRule(index: number) {
    setFormRules(prev => prev.filter((_, i) => i !== index))
  }

  function addRule() {
    setFormRules(prev => [...prev, emptyRule()])
  }

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Threshold Profiles</h1>
        <button className="btn btn-primary" onClick={openCreate}>Create Profile</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : profiles.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            No threshold profiles yet. Create one to define success criteria for your simulations.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Simulation Class</th>
                <th>Rules</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{p.simulationClass}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {p.rules.map((r, i) => (
                        <span key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.label}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="flex-row">
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', color: '#e94560' }}
                        onClick={() => handleDelete(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: '550px', maxWidth: '700px' }}>
            <h3>{editing ? 'Edit Profile' : 'Create Profile'}</h3>

            {error && <div style={{ color: '#e94560', marginTop: '0.5rem', fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production SLA" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>Simulation Class</label>
                <select value={formClass} onChange={(e) => setFormClass(e.target.value)} style={{ width: '100%' }}>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <div className="flex-row" style={{ marginBottom: '0.3rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flex: 1 }}>Rules</label>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                    onClick={addRule}>+ Add Rule</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {formRules.map((rule, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: '0.4rem', alignItems: 'center',
                      padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border-color)'
                    }}>
                      <select value={rule.metric} onChange={(e) => updateRule(i, { metric: e.target.value })}
                        style={{ flex: 2 }}>
                        {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <select value={rule.operator} onChange={(e) => updateRule(i, { operator: e.target.value as ThresholdRule['operator'] })}
                        style={{ flex: 1 }}>
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input type="number" value={rule.value}
                        onChange={(e) => updateRule(i, { value: Number(e.target.value) })}
                        style={{ width: '80px' }} />
                      {formRules.length > 1 && (
                        <button className="btn btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem', color: '#e94560' }}
                          onClick={() => removeRule(i)}>&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-row" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={!formName || !formClass || formRules.length === 0}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
