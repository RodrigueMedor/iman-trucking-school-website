import { Chip, type ChipProps } from '@mui/material'
import EditNoteRounded from '@mui/icons-material/EditNoteRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded'
import ReportProblemRounded from '@mui/icons-material/ReportProblemRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded'
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded'
import CancelRounded from '@mui/icons-material/CancelRounded'
import type { ReactElement } from 'react'
import { STATUS_META, type ApplicationStatus } from './model'

const ICONS: Record<ApplicationStatus, ReactElement> = {
  DRAFT: <EditNoteRounded />,
  SUBMITTED: <SendRounded />,
  UNDER_REVIEW: <ManageSearchRounded />,
  INFO_REQUIRED: <ReportProblemRounded />,
  APPROVED: <CheckCircleRounded />,
  SCHEDULED: <EventAvailableRounded />,
  COMPLETED: <EmojiEventsRounded />,
  REJECTED: <CancelRounded />,
}

/** One status display for the student portal and the admin applications page. */
export function StatusChip({ status, size = 'small', ...rest }: { status: ApplicationStatus } & Omit<ChipProps, 'label' | 'color' | 'icon'>) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT
  return (
    <Chip
      size={size}
      icon={ICONS[status]}
      label={meta.label}
      color={meta.color}
      variant={status === 'DRAFT' ? 'outlined' : 'filled'}
      sx={{ fontWeight: 800, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
      {...rest}
    />
  )
}
