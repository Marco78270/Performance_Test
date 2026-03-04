import { useState, useEffect } from 'react'
import {
  fetchThresholdProfiles, createThresholdProfile, updateThresholdProfile, deleteThresholdProfile,
  type ThresholdProfile, type ThresholdRule, type CreateThresholdProfileRequest,
} from '../api/thresholdApi'
import { fetchSimulationClasses } from '../api/simulationApi'
import { Button, Card, PageHeader, Spinner, Modal, Input, Select, Alert } from '../components/ui'

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

  const modalFooter = (
    <div className="flex-row" style={{ justifyContent: 'flex-end' }}>
      <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleSave}
        disabled={!formName || !formClass || formRules.length === 0}>
        {editing ? 'Update' : 'Create'}
      </Button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Threshold Profiles"
        breadcrumb="Gatling / Thresholds"
        actions={<Button variant="primary" onClick={openCreate}>+ New Profile</Button>}
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : profiles.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-2)', padding: '2rem' }}>
            No threshold profiles yet. Create one to define success criteria for your simulations.
          </div>
        ) : (
          <table className="data-table">
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
                        <span key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text-2)' }}>{r.label}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="flex-row">
                      <Button variant="secondary" size="sm"
                        onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="danger" size="sm"
                        onClick={() => handleDelete(p.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Profile' : 'Create Profile'}
        size="lg"
        footer={modalFooter}
      >
        {error && <Alert variant="error">{error}</Alert>}

        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <Input
            label="Name"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Production SLA"
          />

          <Select
            label="Simulation Class"
            value={formClass}
            onChange={(e) => setFormClass(e.target.value)}
          >
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>

          <div>
            <div className="flex-row" style={{ marginBottom: '0.3rem' }}>
              <label style={{ color: 'var(--color-text-2)', fontSize: '0.8rem', flex: 1 }}>Rules</label>
              <Button variant="secondary" size="sm" onClick={addRule}>+ Add Rule</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {formRules.map((rule, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '0.4rem', alignItems: 'center',
                  padding: '0.5rem', background: 'var(--color-bg)', borderRadius: '4px', border: '1px solid var(--color-border)'
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
                    <Button variant="danger" size="sm"
                      onClick={() => removeRule(i)}>&times;</Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
