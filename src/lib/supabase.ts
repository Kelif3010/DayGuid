import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://mfawhohexxxauqdnbvmz.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3KazaS_VVJauHS2rGSS0uw_6uAgsZue'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// ── Types ────────────────────────────────────────────
export type Profile = {
  id: string; user_id: string; name: string; avatar_url?: string;
  pin_hash?: string; settings: Record<string, any>; created_at: string;
}
export type Schedule = {
  id: string; profile_id: string; name: string; days_of_week: number[];
  is_active: boolean; is_template: boolean; template_name?: string; created_at: string;
}
export type Task = {
  id: string; schedule_id: string; name: string; start_time: string;
  duration_minutes: number; sort_order: number; image_url?: string;
  video_url?: string; audio_url?: string; tts_text?: string;
  pictogram_key?: string; icon_emoji?: string; color: string;
  reminder_type: 'alarm' | 'silent'; enable_mid_reminders: boolean;
  mid_reminder_text?: string; extension_minutes: number; created_at: string;
}
export type AppSettings = {
  id: string; user_id: string; pin_code?: string; language: string;
  tts_rate: number; extension_minutes: number; auto_advance_delay: number;
  show_digital_clock: boolean; vibration_enabled: boolean; sound_enabled: boolean;
  theme: string;
}
export type DayStats = {
  totalTasks: number; completedTasks: number; extensions: number;
  helpUsed: number; stickersEarned: number; avgSeconds: number | null;
}

// ── Auth ─────────────────────────────────────────────
export const auth = {
  signUp: async (email: string, pw: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password: pw })
    if (error) throw error; return data
  },
  signIn: async (email: string, pw: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) throw error; return data
  },
  signOut: () => supabase.auth.signOut(),
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) throw error
  },
  updatePassword: async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error; return data
  },
  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession(); return session
  },
  onAuthChange: (cb: (session: any) => void) =>
    supabase.auth.onAuthStateChange((_, session) => cb(session)),
}

// ── Profiles ─────────────────────────────────────────
export const profilesApi = {
  list: async (): Promise<Profile[]> => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at')
    if (error) throw error; return data || []
  },
  create: async (userId: string, name: string, avatarUrl?: string): Promise<Profile> => {
    const { data, error } = await supabase.from('profiles')
      .insert({ user_id: userId, name, avatar_url: avatarUrl, settings: {} }).select().single()
    if (error) throw error; return data
  },
  update: async (id: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
    if (error) throw error; return data
  },
  delete: async (id: string) => { const { error } = await supabase.from('profiles').delete().eq('id', id); if (error) throw error },
}

// ── Schedules ────────────────────────────────────────
export const schedulesApi = {
  list: async (profileId: string): Promise<Schedule[]> => {
    const { data, error } = await supabase.from('schedules').select('*').eq('profile_id', profileId).order('created_at')
    if (error) throw error; return data || []
  },
  getForToday: async (profileId: string): Promise<Schedule | null> => {
    const dow = new Date().getDay() // 0=So, 1=Mo ... 6=Sa
    const { data, error } = await supabase.from('schedules').select('*')
      .eq('profile_id', profileId).eq('is_active', true).contains('days_of_week', [dow])
    if (error) throw error; return data?.[0] || null
  },
  create: async (profileId: string, name: string, daysOfWeek: number[]): Promise<Schedule> => {
    const { data, error } = await supabase.from('schedules')
      .insert({ profile_id: profileId, name, days_of_week: daysOfWeek, is_active: true }).select().single()
    if (error) throw error; return data
  },
  update: async (id: string, updates: Partial<Schedule>): Promise<Schedule> => {
    const { data, error } = await supabase.from('schedules').update(updates).eq('id', id).select().single()
    if (error) throw error; return data
  },
  delete: async (id: string) => { const { error } = await supabase.from('schedules').delete().eq('id', id); if (error) throw error },
}

// ── Tasks ────────────────────────────────────────────
export const tasksApi = {
  list: async (scheduleId: string): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*').eq('schedule_id', scheduleId).order('sort_order')
    if (error) throw error; return data || []
  },
  create: async (scheduleId: string, task: Partial<Task>): Promise<Task> => {
    const { data, error } = await supabase.from('tasks').insert({
      schedule_id: scheduleId, name: task.name || 'Neue Aufgabe', start_time: task.start_time || '12:00',
      duration_minutes: task.duration_minutes || 10, sort_order: task.sort_order ?? 0, color: task.color || '#B3E5FC',
      reminder_type: task.reminder_type || 'alarm', enable_mid_reminders: task.enable_mid_reminders || false,
      extension_minutes: task.extension_minutes || 5, icon_emoji: task.icon_emoji || '📌',
      tts_text: task.tts_text || '', mid_reminder_text: task.mid_reminder_text || '',
      image_url: task.image_url || null, video_url: task.video_url || null, audio_url: task.audio_url || null,
    }).select().single()
    if (error) throw error; return data
  },
  update: async (id: string, updates: Partial<Task>): Promise<Task> => {
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
    if (error) throw error; return data
  },
  delete: async (id: string) => { const { error } = await supabase.from('tasks').delete().eq('id', id); if (error) throw error },
  reorder: async (items: { id: string; sort_order: number }[]) => {
    for (const item of items) await supabase.from('tasks').update({ sort_order: item.sort_order }).eq('id', item.id)
  },
}

// ── Completions ──────────────────────────────────────
export const completionsApi = {
  record: async (data: {
    task_id: string; profile_id: string; needed_extension: boolean;
    extension_count: number; completion_time_seconds?: number;
    used_help: boolean; auto_completed: boolean;
  }) => {
    const { error } = await supabase.from('task_completions').insert(data)
    if (error) console.warn('Completion save failed:', error)
  },
  today: async (profileId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('task_completions').select('*')
      .eq('profile_id', profileId).eq('completion_date', today)
    return data || []
  },
  // Stats for a given date range
  statsForDate: async (profileId: string, date: string): Promise<DayStats> => {
    const { data: comps } = await supabase.from('task_completions').select('*')
      .eq('profile_id', profileId).eq('completion_date', date)
    const { data: stickers } = await supabase.from('sticker_collection').select('id')
      .eq('profile_id', profileId).eq('earned_date', date)
    const c = comps || []; const s = stickers || []
    const times = c.filter(x => x.completion_time_seconds).map(x => x.completion_time_seconds)
    return {
      totalTasks: 0, // will be filled from task count
      completedTasks: c.length,
      extensions: c.filter(x => x.needed_extension).length,
      helpUsed: c.filter(x => x.used_help).length,
      stickersEarned: s.length,
      avgSeconds: times.length > 0 ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : null,
    }
  },
  // Stats for last N days
  recentStats: async (profileId: string, days: number = 7) => {
    const results: { date: string; completed: number; extensions: number; help: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const { data } = await supabase.from('task_completions').select('needed_extension,used_help')
        .eq('profile_id', profileId).eq('completion_date', dateStr)
      const c = data || []
      results.push({
        date: dateStr,
        completed: c.length,
        extensions: c.filter(x => x.needed_extension).length,
        help: c.filter(x => x.used_help).length,
      })
    }
    return results.reverse()
  },
}

// ── Stickers ─────────────────────────────────────────
export const stickersApi = {
  add: async (profileId: string, sticker: string, taskName: string) => {
    const { error } = await supabase.from('sticker_collection')
      .insert({ profile_id: profileId, sticker, task_name: taskName })
    if (error) console.warn('Sticker save failed:', error)
  },
  today: async (profileId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('sticker_collection').select('*')
      .eq('profile_id', profileId).eq('earned_date', today)
    return data || []
  },
  total: async (profileId: string) => {
    const { data } = await supabase.from('sticker_collection').select('sticker')
      .eq('profile_id', profileId).order('earned_at', { ascending: false }).limit(50)
    return data || []
  },
}

// ── Settings (persistent in DB) ──────────────────────
export const settingsApi = {
  get: async (): Promise<AppSettings | null> => {
    const { data } = await supabase.from('app_settings').select('*').maybeSingle()
    return data
  },
  upsert: async (userId: string, s: Partial<AppSettings>): Promise<AppSettings> => {
    const { data, error } = await supabase.from('app_settings')
      .upsert({ user_id: userId, ...s }, { onConflict: 'user_id' }).select().single()
    if (error) throw error; return data
  },
}

// ── Signed Media URLs ─────────────────────────────────
const extractStoragePath = (urlOrPath: string): string => {
  const m = urlOrPath.match(/\/storage\/v1\/object\/(?:public|sign(?:ed)?)\/media\/(.+?)(?:\?|$)/)
  return m ? m[1] : urlOrPath
}

export const getSignedMediaUrl = async (pathOrUrl: string): Promise<string> => {
  const path = extractStoragePath(pathOrUrl)
  const { data, error } = await supabase.storage.from('media').createSignedUrl(path, 3600)
  if (error || !data) throw error
  return data.signedUrl
}

// ── Media Upload to Supabase Storage ─────────────────
export const mediaUpload = async (
  file: File, userId: string, fileType: 'image' | 'video' | 'audio'
): Promise<string> => {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${fileType}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600', upsert: false,
  })
  if (error) throw error
  return path
}

export const mediaUploadBlob = async (
  blob: Blob, userId: string, fileName: string
): Promise<string> => {
  const file = new File([blob], fileName, { type: blob.type })
  return mediaUpload(file, userId, 'audio')
}
