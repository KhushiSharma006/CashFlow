import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Fetches the households the current user actively belongs to, plus any
 * pending invites waiting on their email address.
 */
export function useHouseholds(user) {
  const [households, setHouseholds] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [activeRes, pendingRes] = await Promise.all([
      supabase
        .from('household_members')
        .select('id, role, household_id, households(id, name, created_by)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      supabase
        .from('household_members')
        .select('id, household_id, invited_email, created_at, households(id, name)')
        .eq('invited_email', user.email)
        .eq('status', 'pending'),
    ])

    setHouseholds(
      (activeRes.data || [])
        .filter((m) => m.households)
        .map((m) => ({
          id: m.households.id,
          name: m.households.name,
          role: m.role,
          isOwner: m.role === 'owner',
          membershipId: m.id,
        }))
    )
    setPendingInvites(
      (pendingRes.data || [])
        .filter((m) => m.households)
        .map((m) => ({
          membershipId: m.id,
          householdId: m.households.id,
          householdName: m.households.name,
          invitedAt: m.created_at,
        }))
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { households, pendingInvites, loading, refresh }
}
