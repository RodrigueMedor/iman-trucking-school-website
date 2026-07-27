import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Box, Button, Chip, Container, FormControlLabel, Grid, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ImageRoundedIcon from '@mui/icons-material/ImageRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { Link, useSearchParams } from 'react-router-dom'
import { contentPages } from '../config/contentPages'
import { supabase } from '../lib/supabase'
import { useContent, type SchoolContent } from '../contexts/ContentContext'
import { galleryImages, legalContent, pageContent, testimonials } from '../components/InternalPage'

const empty: Partial<SchoolContent> = { page: 'home', section_key: 'custom-', section_label: '', title: '', body: '', bullets: '', image_url: '', button_text: '', button_url: '', sort_order: 100, published: true }

export function AdminContent() {
  const { entries, refresh } = useContent()
  const [searchParams] = useSearchParams()
  const requestedPage = searchParams.get('page')
  const initialFilter = contentPages.some(page => page.value === requestedPage) ? requestedPage! : 'all'
  const [filter, setFilter] = useState(initialFilter)
  const [editing, setEditing] = useState<Partial<SchoolContent>>({ ...empty, page: initialFilter === 'all' ? 'home' : initialFilter })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const inventory = useMemo<SchoolContent[]>(() => {
    const defaults: SchoolContent[] = []
    const add = (page: string, section_key: string, fields: Partial<SchoolContent>) => defaults.push({
      id: '', page, section_key, section_label: fields.section_label ?? section_key, title: fields.title ?? '', body: fields.body ?? '',
      bullets: fields.bullets ?? '', image_url: fields.image_url ?? '', button_text: fields.button_text ?? '', button_url: fields.button_url ?? '',
      sort_order: fields.sort_order ?? 100, published: true,
    })
    Object.entries(pageContent).forEach(([path, page]) => {
      const pageKey = path.replace(/^\/|\/$/g, '')
      page.sections.forEach((section, index) => add(pageKey, `section-${index + 1}`, {
        section_label: `Content section ${index + 1}`, title: section.title, body: section.body,
        bullets: section.bullets?.join('\n') ?? '', sort_order: index + 10,
      }))
    })
    Object.entries(legalContent).forEach(([path, page]) => {
      const pageKey = path.replace(/^\/|\/$/g, '')
      page.sections.forEach((section, index) => add(pageKey, `section-${index + 1}`, {
        section_label: `Legal section ${index + 1}`, title: section.title, body: section.body,
        bullets: section.bullets?.join('\n') ?? '', sort_order: index + 10,
      }))
    })
    galleryImages.forEach((image_url, index) => add('gallery', `image-${index + 1}`, { section_label: `Gallery image ${index + 1}`, image_url, sort_order: index + 10 }))
    testimonials.forEach((item, index) => add('testimonials', `testimonial-${index + 1}`, { section_label: `Testimonial ${index + 1}`, title: item.name, body: item.quote, sort_order: index + 10 }))
    return [...entries, ...defaults.filter(item => !entries.some(entry => entry.page === item.page && entry.section_key === item.section_key))]
  }, [entries])
  const filtered = useMemo(() => inventory.filter(item => {
    const pageMatches = filter === 'all' || item.page === filter
    const query = search.trim().toLowerCase()
    return pageMatches && (!query || [item.title, item.body, item.section_label, item.section_key, item.page].some(value => value.toLowerCase().includes(query)))
  }), [inventory, filter, search])
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
  const duplicate = (item: SchoolContent) => {
    const { id: _id, ...copy } = item
    setEditing({ ...copy, section_key: `custom-${item.section_key}-copy`, title: `${item.title} (copy)`, sort_order: item.sort_order + 1 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const previewPath = contentPages.find(page => page.value === (filter === 'all' ? editing.page : filter))?.path || '/'
  useEffect(() => {
    const missing = inventory.filter(item => !item.id)
    if (!supabase || !missing.length || syncing) return
    setSyncing(true)
    const payload = missing.map(({ id: _id, ...item }) => item)
    void supabase.from('school_content').upsert(payload, { onConflict: 'page,section_key', ignoreDuplicates: true }).then(async result => {
      if (result.error) setError(`Some sections could not be synchronized: ${result.error.message}`)
      else {
        setMessage(`${missing.length} missing sections were converted to dynamic content.`)
        await refresh()
      }
      setSyncing(false)
    })
  }, [inventory, refresh, syncing])
  return <><Box sx={{ bgcolor: 'primary.main', color: 'white', py: 6 }}><Container><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}><Box><Typography variant="h2" fontWeight={950}>Website content</Typography><Typography color="rgba(255,255,255,.72)" mt={1}>Every identified page section can be opened and saved as dynamic content.</Typography></Box><Button component={Link} to={previewPath} target="_blank" variant="contained" color="secondary" startIcon={<OpenInNewRoundedIcon />}>Preview selected page</Button></Stack></Container></Box><Container sx={{ py: 5 }}>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}<Grid container spacing={3} alignItems="flex-start"><Grid size={{ xs: 12, lg: 5 }}><Paper component="form" onSubmit={save} sx={{ p: 3.5, borderRadius: 3, position: { lg: 'sticky' }, top: 92 }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between"><Typography variant="h5" fontWeight={950}>{editing.id ? 'Edit section' : editing.section_key && editing.section_key !== 'custom-' ? 'Make section dynamic' : 'Add section'}</Typography>{editing.section_key !== 'custom-' && <Button onClick={reset}>Cancel</Button>}</Stack><TextField select required label="Website page" value={editing.page || 'home'} onChange={event => setEditing({ ...editing, page: event.target.value })}>{contentPages.map(page => <MenuItem key={page.value} value={page.value}>{page.label}</MenuItem>)}</TextField><TextField required label="Section key" value={editing.section_key || ''} onChange={event => setEditing({ ...editing, section_key: event.target.value })} helperText="Each key identifies one visible section or repeated item." /><TextField required label="Section label" value={editing.section_label || ''} onChange={event => setEditing({ ...editing, section_label: event.target.value })} /><TextField label="Heading" value={editing.title || ''} onChange={event => setEditing({ ...editing, title: event.target.value })} /><TextField multiline minRows={4} label="Body text" value={editing.body || ''} onChange={event => setEditing({ ...editing, body: event.target.value })} /><TextField multiline minRows={3} label="Bullet list" helperText="Enter one bullet per line." value={editing.bullets || ''} onChange={event => setEditing({ ...editing, bullets: event.target.value })} /><TextField label="Image URL" value={editing.image_url || ''} onChange={event => setEditing({ ...editing, image_url: event.target.value })} /><Button component="label" variant="outlined" startIcon={<ImageRoundedIcon />}>Upload image<input hidden type="file" accept="image/*" onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} /></Button>{editing.image_url && <Box component="img" src={editing.image_url} alt="Selected content" sx={{ width: '100%', maxHeight: 210, objectFit: 'cover', borderRadius: 2 }} />}<Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Button text" value={editing.button_text || ''} onChange={event => setEditing({ ...editing, button_text: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Button URL" value={editing.button_url || ''} onChange={event => setEditing({ ...editing, button_url: event.target.value })} /></Grid></Grid><TextField type="number" label="Display order" value={editing.sort_order ?? 100} onChange={event => setEditing({ ...editing, sort_order: Number(event.target.value) })} /><FormControlLabel control={<Switch checked={editing.published ?? true} onChange={event => setEditing({ ...editing, published: event.target.checked })} />} label="Published" /><Button type="submit" variant="contained" color="secondary" size="large" disabled={saving} startIcon={editing.id ? <EditRoundedIcon /> : <AddRoundedIcon />}>{saving ? 'Saving…' : editing.id ? 'Update section' : 'Save as dynamic content'}</Button></Stack></Paper></Grid><Grid size={{ xs: 12, lg: 7 }}><Paper sx={{ p: 3.5, borderRadius: 3 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} mb={2}><Box><Typography variant="h5" fontWeight={950}>Complete content inventory</Typography><Typography color="text.secondary">{filtered.length} identified sections and items</Typography></Box><TextField select size="small" label="Filter page" value={filter} onChange={event => setFilter(event.target.value)} sx={{ minWidth: 220 }}><MenuItem value="all">All pages</MenuItem>{contentPages.map(page => <MenuItem key={page.value} value={page.value}>{page.label}</MenuItem>)}</TextField></Stack><TextField fullWidth size="small" placeholder="Search headings, text, keys, or pages…" value={search} onChange={event => setSearch(event.target.value)} slotProps={{ input: { startAdornment: <SearchRoundedIcon sx={{ mr: 1, color: 'text.secondary' }} /> } }} sx={{ mb: 2.5 }} /><Stack spacing={1.5}>{filtered.map(item => <Paper key={`${item.page}-${item.section_key}`} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}><Box><Stack direction="row" spacing={1}><Chip size="small" label={item.page} /><Chip size="small" color={item.id ? (item.published ? 'success' : 'default') : 'warning'} label={item.id ? (item.published ? 'Dynamic' : 'Draft') : 'Built-in'} /></Stack><Typography fontWeight={900} mt={1.5}>{item.section_label || item.title}</Typography><Typography variant="body2" color="text.secondary">{item.section_key}</Typography></Box><Stack direction="row" alignItems="center" flexWrap="wrap"><Button size="small" startIcon={<EditRoundedIcon />} onClick={() => { setEditing(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{item.id ? 'Edit' : 'Make dynamic'}</Button><Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => duplicate(item)}>Duplicate</Button>{item.id && <Button size="small" color="error" startIcon={<DeleteRoundedIcon />} onClick={() => void remove(item)}>Delete</Button>}</Stack></Stack></Paper>)}{!filtered.length && <Alert severity="info">No content matches this page and search.</Alert>}</Stack></Paper></Grid></Grid></Container></>
}
