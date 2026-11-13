import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholds } from '../hooks/useHouseholds'

function CreateHouseholdForm({ user, onDone }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Give your household a name.')
      return
    }
    setSaving(true)

    const { data: household, error: createErr } = await supabase
      .from('households')
      .insert({ name: name.trim(), created_by: user.id })
      .select()
      .single()

    if (createErr) {
      setSaving(false)
      setError(createErr.message)
      return
    }

    const { error: memberErr } = await supabase.from('household_members').insert({
      household_id: household.id,
      user_id: user.id,
      invited_email: user.email,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    setSaving(false)
    if (memberErr) {
      setError(memberErr.message)
      return
    }
    setName('')
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-5 mb-8">
      <h2 className="font-display text-lg font-semibold text-ink mb-3">Create a household</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sharma Household"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-ink text-paper-raised rounded-md px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
      </div>
      {error && <p className="text-rust text-sm mt-2 bg-rust-soft rounded-md px-3 py-2">{error}</p>}
    </form>
  )
}

function InviteForm({ householdId, onDone }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email.trim()) return
    setSaving(true)

    const { error } = await supabase.from('household_members').insert({
      household_id: householdId,
      invited_email: email.trim().toLowerCase(),
      role: 'member',
      status: 'pending',
    })

    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'Already invited.' : error.message)
      return
    }
    setSuccess(`Invited ${email.trim()}`)
    setEmail('')
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Invite by email"
        className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:border-brass outline-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="border border-line rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-raised transition-colors disabled:opacity-60"
      >
        Invite
      </button>
      {error && <p className="text-rust text-xs">{error}</p>}
      {success && <p className="text-sage text-xs">{success}</p>}
    </form>
  )
}

function HouseholdMembers({ householdId }) {
  const [members, setMembers] = useState(null)

  const load = async () => {
    const { data } = await supabase
      .from('household_members')
      .select('id, invited_email, role, status, user_id')
      .eq('household_id', householdId)
      .order('created_at')
    setMembers(data || [])
  }

  if (members === null) {
    load()
    return <p className="text-xs text-ink-soft mt-2">Loading members…</p>
  }

  return (
    <ul className="mt-3 space-y-1.5">
      {members.map((m) => (
        <li key={m.id} className="flex items-center justify-between text-sm">
          <span className="text-ink">{m.invited_email || m.user_id}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-soft capitalize">{m.role}</span>
            {m.status === 'pending' && (
              <span className="text-xs text-brass bg-brass-soft rounded-full px-2 py-0.5">pending</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function Households() {
  const { user } = useAuth()
  const { households, pendingInvites, loading, refresh } = useHouseholds(user)
  const [expandedId, setExpandedId] = useState(null)

  const handleAcceptInvite = async (invite) => {
    await supabase
      .from('household_members')
      .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
      .eq('id', invite.membershipId)
    refresh()
  }

  const handleDeclineInvite = async (invite) => {
    await supabase.from('household_members').delete().eq('id', invite.membershipId)
    refresh()
  }

  const handleLeave = async (household) => {
    if (!confirm(`Leave "${household.name}"? You'll lose access to its shared budgets and expenses.`)) return
    await supabase.from('household_members').delete().eq('id', household.membershipId)
    refresh()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Households</h1>
        <p className="text-ink-soft text-sm mt-1">
          Share budgets and expenses with family or roommates. Personal data always stays private.
        </p>
      </div>

      {pendingInvites.length > 0 && (
        <div className="mb-8 space-y-3">
          {pendingInvites.map((invite) => (
            <div key={invite.membershipId} className="bg-brass-soft border border-brass/30 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-ink">
                You've been invited to join <span className="font-medium">{invite.householdName}</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptInvite(invite)}
                  className="bg-ink text-paper-raised rounded-md px-3 py-1.5 text-sm font-medium hover:bg-ink-soft transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDeclineInvite(invite)}
                  className="border border-line rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-raised transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateHouseholdForm user={user} onDone={refresh} />

      <h2 className="font-display text-lg font-semibold text-ink mb-3">Your households</h2>
      {loading ? (
        <p className="font-mono text-sm text-ink-soft">Loading…</p>
      ) : households.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-8 text-center">
          <p className="text-sm text-ink-soft">
            No households yet. Create one above, then invite members and tag budgets/expenses as shared when adding them.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {households.map((h) => (
            <div key={h.id} className="bg-surface border border-line rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{h.name}</p>
                  <p className="text-xs text-ink-soft capitalize">{h.role}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                    className="text-ink-soft hover:text-ink"
                  >
                    {expandedId === h.id ? 'Hide members' : 'Show members'}
                  </button>
                  <button onClick={() => handleLeave(h)} className="text-ink-soft hover:text-rust">
                    Leave
                  </button>
                </div>
              </div>

              {expandedId === h.id && (
                <>
                  <HouseholdMembers householdId={h.id} />
                  {h.isOwner && <InviteForm householdId={h.id} onDone={refresh} />}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-soft mt-6">
        When adding an expense or setting a budget, you can tag it to a household instead of keeping it personal — members then see and contribute to that budget together.
      </p>
    </div>
  )
}
