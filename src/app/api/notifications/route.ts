import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// GET /api/notifications
//   ?limit=20 &offset=0 &unread_only=1 &level=critical|warning|info &farm_id=<uuid>
export async function GET(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const limit = Math.min(100, Number(sp.get('limit') ?? 20))
  const offset = Math.max(0, Number(sp.get('offset') ?? 0))
  const unreadOnly = sp.get('unread_only') === '1'
  const level = sp.get('level')
  const farmId = sp.get('farm_id')

  let q = supabase
    .from('notifications')
    .select('id, type, title, message, metadata, read_at, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (unreadOnly) q = q.is('read_at', null)
  if (level === 'critical') q = q.eq('type', 'alert_critical')
  else if (level === 'warning') q = q.eq('type', 'alert_warning')
  else if (level === 'info') q = q.eq('type', 'info')
  if (farmId) q = q.contains('metadata', { farm_id: farmId })

  let { data, error, count } = await q

  // Graceful fallback if database lacks 'metadata' or 'read_at' columns
  if (error && (error.message.includes('metadata') || error.message.includes('read_at'))) {
    console.warn('[/api/notifications] Full query failed, falling back to base schema:', error.message)
    let fallbackQ = supabase
      .from('notifications')
      .select('id, type, title, message, read, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) fallbackQ = fallbackQ.eq('read', false)
    if (level === 'critical') fallbackQ = fallbackQ.eq('type', 'alert_critical')
    else if (level === 'warning') fallbackQ = fallbackQ.eq('type', 'alert_warning')
    else if (level === 'info') fallbackQ = fallbackQ.eq('type', 'info')

    const fbRes = await fallbackQ
    if (!fbRes.error) {
      data = (fbRes.data ?? []).map((row: any) => ({
        ...row,
        metadata: {},
        read_at: row.read ? row.created_at : null,
      }))
      count = fbRes.count
      error = null
    } else {
      return NextResponse.json({ error: fbRes.error.message }, { status: 500 })
    }
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate unread count
  let unread = 0
  const unreadRes = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (unreadRes.error && unreadRes.error.message.includes('read_at')) {
    const fallbackUnread = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    unread = fallbackUnread.count ?? 0
  } else {
    unread = unreadRes.count ?? 0
  }

  return NextResponse.json({
    notifications: data ?? [],
    total: count ?? 0,
    unread: unread ?? 0,
  })
}

// POST — actions
//   { action: 'mark_all_read' }
//   { action: 'mark_read' | 'mark_unread' | 'delete', ids: string[] }
//   { action: 'delete_all_read' }
export async function POST(req: NextRequest) {
  const { user, supabase } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { action?: string; ids?: string[] }
  const now = new Date().toISOString()

  switch (body.action) {
    case 'mark_all_read': {
      let { error } = await supabase
        .from('notifications')
        .update({ read_at: now, read: true })
        .eq('user_id', user.id)
        .is('read_at', null)

      if (error && error.message.includes('read_at')) {
        const fb = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false)
        error = fb.error
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'mark_read': {
      if (!Array.isArray(body.ids) || body.ids.length === 0)
        return NextResponse.json({ error: 'ids required' }, { status: 400 })

      let { error } = await supabase
        .from('notifications')
        .update({ read_at: now, read: true })
        .eq('user_id', user.id)
        .in('id', body.ids)

      if (error && error.message.includes('read_at')) {
        const fb = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .in('id', body.ids)
        error = fb.error
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'mark_unread': {
      if (!Array.isArray(body.ids) || body.ids.length === 0)
        return NextResponse.json({ error: 'ids required' }, { status: 400 })

      let { error } = await supabase
        .from('notifications')
        .update({ read_at: null, read: false })
        .eq('user_id', user.id)
        .in('id', body.ids)

      if (error && error.message.includes('read_at')) {
        const fb = await supabase
          .from('notifications')
          .update({ read: false })
          .eq('user_id', user.id)
          .in('id', body.ids)
        error = fb.error
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'delete': {
      if (!Array.isArray(body.ids) || body.ids.length === 0)
        return NextResponse.json({ error: 'ids required' }, { status: 400 })
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .in('id', body.ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    case 'delete_all_read': {
      let { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .not('read_at', 'is', null)

      if (error && error.message.includes('read_at')) {
        const fb = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('read', true)
        error = fb.error
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
