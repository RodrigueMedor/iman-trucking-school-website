import { useMemo, useState, type FormEvent } from 'react'
import { Alert, Box, Button, Chip, Container, FormControlLabel, Grid, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import { contentPages } from '../config/contentPages'
import { supabase } from '../lib/supabase'
import { useContent, type SchoolContent } from '../contexts/ContentContext'

const empty: Partial<SchoolContent> = { page: 'home', section_key: 'custom-', section_label: '', title: '', body: '', bullets: '', image_url: '', button_text: '', button_url: '', sort_order: 100, published: true }

export function AdminContent() {
  const { entries, refresh } = useContent()
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Partial<SchoolContent>>(empty)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const filtered = useMemo(() => entries.filter(item => filter === 'all' || item.page === filter), [entries, filter])
  const reset = () => setEditing({ ...empty, page: filter === 'all' ? 'home' : filter })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setSaving(true); setError(''); setMessage('')
    const { id, ...fields } = editing
    const result = id ? await supabase.from('school_content').update(fields).eq('id', id) : await supabase.from('school_content').insert(fields)
    setSaving(false)
    if (result.error) return setError(result.error.message)
    setMessage(id ? 'Content updated and published.' : 'Content section created.')
    reset(); await refresh()
  }
  const remove = async (item: SchoolContent) => {
    if (!supabase || !window.confirm(`Delete “${item.section_label || item.title}”?`)) return
    const { error: failure } = await supabase.from('school_content').delete().eq('id', item.id)
    if (failure) return setError(failure.message)
    setMessage('Content section deleted.'); await refresh()
  }
  const upload = async (file: File) => {
    if (!supabase) return
    const extension = file.name.split('.').pop() || 'jpg'
    const path = `school/${crypto.randomUUID()}.${extension}`
    const result = await supabase.storage.from('school-media').upload(path, file)
    if (result.error) return setError(result.error.message)
    const { data } = supabase.storage.from('school-media').getPublicUrl(path)
    setEditing(current => ({ ...current, image_url: data.publicUrl }))
  }
  return <><Box sx={{ bgcolor: 'primary.main', color: 'white', py: 6 }}><Container><Typography variant="h2" fontWeight={950}>Website content</Typography><Typography color="rgba(255,255,255,.72)" mt={1}>Create, edit, publish, reorder, and remove content across every page.</Typography></Container></Box><Container sx={{ py: 5 }}>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}<Grid container spacing={3} alignItems="flex-start"><Grid size={{ xs: 12, lg: 5 }}><Paper component="form" onSubmit={save} sx={{ p: 3.5, borderRadius: 3, position: { lg: 'sticky' }, top: 92 }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between"><Typography variant="h5" fontWeight={950}>{editing.id ? 'Edit section' : 'Add section'}</Typography>{editing.id && <Button onClick={reset}>Cancel</Button>}</Stack><TextField select required label="Website page" value={editing.page || 'home'} onChange={event => setEditing({ ...editing, page: event.target.value })}>{contentPages.map(page => <MenuItem key={page.value} value={page.value}>{page.label}</MenuItem>)}</TextField><TextField required label="Section key" value={editing.section_key || ''} onChange={event => setEditing({ ...editing, section_key: event.target.value })} helperText="Use hero for the page banner or custom-name for a new section." /><TextField required label="Section label" value={editing.section_label || ''} onChange={event => setEditing({ ...editing, section_label: event.target.value })} /><TextField label="Heading" value={editing.title || ''} onChange={event => setEditing({ ...editing, title: event.target.value })} /><TextField multiline minRows={4} label="Body text" value={editing.body || ''} onChange={event => setEditing({ ...editing, body: event.target.value })} /><TextField multiline minRows={3} label="Bullet list" helperText="Enter one bullet per line." value={editing.bullets || ''} onChange={event => setEditing({ ...editing, bullets: event.target.value })} /><TextField label="Image URL" value={editing.image_url || ''} onChange={event => setEditing({ ...editing, image_url: event.target.value })} /><Button component="label" variant="outlined" startIcon={<ImageRoundedIcon />}>Upload image<input hidden type="file" accept="image/*" onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} /></Button><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Button text" value={editing.button_text || ''} onChange={event => setEditing({ ...editing, button_text: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Button URL" value={editing.button_url || ''} onChange={event => setEditing({ ...editing, button_url: event.target.value })} /></Grid></Grid><TextField type="number" label="Display order" value={editing.sort_order ?? 100} onChange={event => setEditing({ ...editing, sort_order: Number(event.target.value) })} /><FormControlLabel control={<Switch checked={editing.published ?? true} onChange={event => setEditing({ ...editing, published: event.target.checked })} />} label="Published" /><Button type="submit" variant="contained" color="secondary" size="large" disabled={saving} startIcon={editing.id ? <EditRoundedIcon /> : <AddRoundedIcon />}>{saving ? 'Saving…' : editing.id ? 'Update section' : 'Create section'}</Button></Stack></Paper></Grid><Grid size={{ xs: 12, lg: 7 }}><Paper sx={{ p: 3.5, borderRadius: 3 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} mb={3}><Box><Typography variant="h5" fontWeight={950}>Content library</Typography><Typography color="text.secondary">{filtered.length} sections</Typography></Box><TextField select size="small" label="Filter page" value={filter} onChange={event => setFilter(event.target.value)} sx={{ minWidth: 220 }}><MenuItem value="all">All pages</MenuItem>{contentPages.map(page => <MenuItem key={page.value} value={page.value}>{page.label}</MenuItem>)}</TextField></Stack><Stack spacing={1.5}>{filtered.map(item => <Paper key={item.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}><Box><Stack direction="row" spacing={1}><Chip size="small" label={item.page} /><Chip size="small" color={item.published ? 'success' : 'default'} label={item.published ? 'Published' : 'Draft'} /></Stack><Typography fontWeight={900} mt={1.5}>{item.section_label || item.title}</Typography><Typography variant="body2" color="text.secondary">{item.section_key}</Typography></Box><Stack direction="row" alignItems="center"><Button size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditing(item)}>Edit</Button><Button size="small" color="error" startIcon={<DeleteRoundedIcon />} onClick={() => void remove(item)}>Delete</Button></Stack></Stack></Paper>)}{!filtered.length && <Alert severity="info">No managed content yet for this page.</Alert>}</Stack></Paper></Grid></Grid></Container></>
}
