import { useRef, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, List, ListItem, ListItemIcon, ListItemText, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import ImageRounded from '@mui/icons-material/ImageRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import { deleteDocument, documentUrl, toMessage, uploadDocument, type ApplicationDocument } from './api'
import { DOC_LABEL, DOC_TYPES, type DocType } from './model'
import { validateUploadFile } from './schemas'
import { formatBytes, formatDate } from './ui'

const DOC_STATUS: Record<ApplicationDocument['status'], { label: string; color: 'default' | 'success' | 'error' }> = {
  UPLOADED: { label: 'Received', color: 'default' },
  ACCEPTED: { label: 'Accepted', color: 'success' },
  REJECTED: { label: 'Needs replacement', color: 'error' },
}

export function DocumentList({ documents, editable, onDeleted }: {
  documents: ApplicationDocument[]
  editable: boolean
  onDeleted?: (doc: ApplicationDocument) => void
}) {
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const open = async (doc: ApplicationDocument) => {
    setError('')
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await documentUrl(doc)
      if (tab) tab.location.href = url
      else window.location.assign(url)
    } catch (err) {
      tab?.close()
      setError(toMessage(err))
    }
  }

  const remove = async (doc: ApplicationDocument) => {
    setError('')
    setBusyId(doc.id)
    try {
      await deleteDocument(doc)
      onDeleted?.(doc)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <List disablePadding>
        {documents.map(doc => (
          <ListItem
            key={doc.id}
            divider
            sx={{ px: 0, gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'primary.light' }}>
              {doc.mime_type === 'application/pdf' ? <PictureAsPdfRounded /> : <ImageRounded />}
            </ListItemIcon>
            <ListItemText
              primary={doc.file_name}
              secondary={`${DOC_LABEL[doc.doc_type]} · ${formatBytes(doc.size_bytes)} · ${formatDate(doc.created_at)}`}
              primaryTypographyProps={{ fontWeight: 700, sx: { wordBreak: 'break-all' } }}
              sx={{ minWidth: 0 }}
            />
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 'auto' }}>
              <Chip size="small" label={DOC_STATUS[doc.status].label} color={DOC_STATUS[doc.status].color} variant="outlined" />
              <Tooltip title="View">
                <IconButton onClick={() => void open(doc)} aria-label={`View ${doc.file_name}`}><OpenInNewRounded /></IconButton>
              </Tooltip>
              {editable && (
                <Tooltip title="Remove">
                  <span>
                    <IconButton onClick={() => void remove(doc)} disabled={busyId === doc.id} aria-label={`Remove ${doc.file_name}`}>
                      {busyId === doc.id ? <CircularProgress size={20} /> : <DeleteOutlineRounded />}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
          </ListItem>
        ))}
      </List>
    </>
  )
}

/** Validated upload to the student's private folder for one application. */
export function DocumentUploader({ applicationId, documents, onChange, defaultType = 'LICENSE_CLP' }: {
  applicationId: string
  documents: ApplicationDocument[]
  onChange: (documents: ApplicationDocument[]) => void
  defaultType?: DocType
}) {
  const input = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState<DocType>(defaultType)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setErrors([])
    setNotice('')
    setUploading(true)
    const added: ApplicationDocument[] = []
    const failed: string[] = []
    for (const file of Array.from(files)) {
      const invalid = validateUploadFile(file)
      if (invalid) {
        failed.push(`${file.name}: ${invalid}`)
        continue
      }
      try {
        added.push(await uploadDocument(applicationId, docType, file))
      } catch (err) {
        failed.push(`${file.name}: ${toMessage(err)}`)
      }
    }
    if (added.length) {
      onChange([...added, ...documents])
      setNotice(added.length === 1 ? 'Document uploaded.' : `${added.length} documents uploaded.`)
    }
    setErrors(failed)
    setUploading(false)
    if (input.current) input.current.value = ''
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 3, p: { xs: 2, md: 3 }, bgcolor: '#fafbfd' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField select label="Document type" value={docType} onChange={e => setDocType(e.target.value as DocType)} sx={{ minWidth: 230 }} size="small">
            {DOC_TYPES.map(type => <MenuItem key={type} value={type}>{DOC_LABEL[type]}</MenuItem>)}
          </TextField>
          <Button
            variant="contained"
            color="primary"
            startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileRounded />}
            onClick={() => input.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Choose files'}
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            onChange={e => void upload(e.target.files)}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          PDF, JPG or PNG, up to 10 MB each. Photograph both sides of your license in good light.
        </Typography>
      </Box>
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {errors.length > 0 && (
        <Alert severity="error" onClose={() => setErrors([])}>
          {errors.length === 1 ? errors[0] : <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map(e => <li key={e}>{e}</li>)}</ul>}
        </Alert>
      )}
      {documents.length > 0 && (
        <DocumentList documents={documents} editable onDeleted={doc => onChange(documents.filter(d => d.id !== doc.id))} />
      )}
    </Stack>
  )
}
