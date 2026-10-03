import { useEffect, useMemo, useState } from 'react'
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material'
import FolderRounded from '@mui/icons-material/FolderRounded'
import { listDocuments, listMyApplications, toMessage, type Application, type ApplicationDocument } from '../api'
import { isEditableByStudent, TYPE_LABEL } from '../model'
import { DocumentList, DocumentUploader } from '../DocumentUploader'
import { StatusChip } from '../StatusChip'
import { EmptyState, ListSkeleton, PageHeader, SectionCard } from '../ui'

export function DocumentsPage() {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [documents, setDocuments] = useState<ApplicationDocument[]>([])
  const [error, setError] = useState('')
  const [target, setTarget] = useState('')

  useEffect(() => {
    Promise.all([listMyApplications(), listDocuments()])
      .then(([a, d]) => {
        setApps(a)
        setDocuments(d)
        setTarget(a.find(x => isEditableByStudent(x.status))?.id ?? '')
      })
      .catch(err => {
        setError(toMessage(err))
        setApps([])
      })
  }, [])

  const editableApps = useMemo(() => (apps ?? []).filter(a => isEditableByStudent(a.status)), [apps])
  const grouped = useMemo(() => (apps ?? [])
    .map(app => ({ app, docs: documents.filter(d => d.application_id === app.id) }))
    .filter(g => g.docs.length > 0), [apps, documents])

  return (
    <>
      <PageHeader title="Documents" subtitle="Upload and view the documents attached to your applications." />
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Stack spacing={3}>
        <SectionCard title="Upload a document">
          {apps === null ? <ListSkeleton rows={1} /> : editableApps.length === 0 ? (
            <Typography color="text.secondary">
              Documents can be added while an application is a draft or when admissions asks for more information. Start an application to upload documents.
            </Typography>
          ) : (
            <Stack spacing={2}>
              <TextField select label="Attach to application" value={target} onChange={e => setTarget(e.target.value)} sx={{ maxWidth: 480 }}>
                {editableApps.map(a => <MenuItem key={a.id} value={a.id}>{TYPE_LABEL[a.application_type]} · {a.reference_no}</MenuItem>)}
              </TextField>
              {target && (
                <DocumentUploader
                  key={target}
                  applicationId={target}
                  documents={documents.filter(d => d.application_id === target)}
                  onChange={docs => setDocuments(all => [...docs, ...all.filter(d => d.application_id !== target)])}
                />
              )}
            </Stack>
          )}
        </SectionCard>

        {apps === null ? <ListSkeleton /> : grouped.length === 0 ? (
          <SectionCard><EmptyState icon={<FolderRounded />} title="No documents yet" body="Documents you upload to an application appear here." /></SectionCard>
        ) : grouped.map(({ app, docs }) => (
          <SectionCard key={app.id} title={`${TYPE_LABEL[app.application_type]} · ${app.reference_no}`} action={<StatusChip status={app.status} />}>
            <DocumentList
              documents={docs}
              editable={isEditableByStudent(app.status)}
              onDeleted={doc => setDocuments(all => all.filter(d => d.id !== doc.id))}
            />
          </SectionCard>
        ))}
      </Stack>
    </>
  )
}
