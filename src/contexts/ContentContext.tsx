import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type SchoolContent = {
  id: string
  page: string
  section_key: string
  section_label: string
  title: string
  body: string
  bullets: string
  image_url: string
  button_text: string
  button_url: string
  sort_order: number
  published: boolean
}

type Fallback = Partial<Omit<SchoolContent, 'id' | 'page' | 'section_key'>>
type ContentValue = {
  entries: SchoolContent[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  content: (page: string, key: string, fallback?: Fallback) => SchoolContent
}

const Context = createContext<ContentValue | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SchoolContent[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  const refresh = async () => {
    if (!supabase) return setLoading(false)
    setError('')
    const { data, error: loadError } = await supabase.from('school_content').select('*').order('page').order('sort_order')
    if (loadError) setError(loadError.message)
    setEntries((data as SchoolContent[] | null) ?? [])
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  const value = useMemo<ContentValue>(() => ({
    entries,
    loading,
    error,
    refresh,
    content: (page, key, fallback = {}) => entries.find(item => item.page === page && item.section_key === key && item.published) ?? {
      id: '', page, section_key: key,
      section_label: fallback.section_label ?? key,
      title: fallback.title ?? '',
      body: fallback.body ?? '',
      bullets: fallback.bullets ?? '',
      image_url: fallback.image_url ?? '',
      button_text: fallback.button_text ?? '',
      button_url: fallback.button_url ?? '',
      sort_order: fallback.sort_order ?? 0,
      published: fallback.published ?? true,
    },
  }), [entries, loading, error])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useContent() {
  const value = useContext(Context)
  if (!value) throw new Error('useContent must be used inside ContentProvider')
  return value
}
