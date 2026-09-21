import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pohnkzwdprodcodkfdze.supabase.co'
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_3l165GUIHt6zY6xoLt6Q2Q_qvVR6Apy'

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseKey)
}

