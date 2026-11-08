import { Accordion, AccordionDetails, AccordionSummary, Box, Container, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import type { ReactNode } from 'react'
import { useContent } from '../contexts/ContentContext'
import { cdlFaq, FAQ_PAGE_KEY, faqStructuredData } from '../config/cdlFaq'

export type ResolvedFaq = { key: string; question: string; answer: string }

/**
 * The CDL FAQ with admin edits applied. Each question is the content entry
 * `how-to-get-a-cdl / faq-N`; saving one as a draft hides it everywhere.
 */
export function useCdlFaq(): ResolvedFaq[] {
  const { entries, content } = useContent()
  const hidden = new Set(entries.filter(item => item.page === FAQ_PAGE_KEY && !item.published).map(item => item.section_key))
  return cdlFaq
    .map((item, index) => content(FAQ_PAGE_KEY, `faq-${index + 1}`, {
      section_label: `FAQ ${index + 1}`,
      title: item.question,
      body: item.answer,
      sort_order: index + 100,
    }))
    .filter(item => !hidden.has(item.section_key) && item.title && item.body)
    .map(item => ({ key: item.section_key, question: item.title, answer: item.body }))
}

export function FaqAccordions({ items }: { items: ResolvedFaq[] }) {
  return <>
    {items.map(item => (
      <Accordion key={item.key} disableGutters elevation={0} sx={{ mb: 1.5, border: '1px solid #e5e8ef', borderRadius: '12px !important', '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2.5, py: 0.5 }}>
          <Typography component="h3" fontWeight={850} color="primary.main">{item.question}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pt: 0, pb: 2.5 }}>
          <Typography color="text.secondary" lineHeight={1.8}>{item.answer}</Typography>
        </AccordionDetails>
      </Accordion>
    ))}
  </>
}

/** The complete FAQ with FAQPage structured data. Render it on one page only. */
export function CdlFaqSection({ children }: { children?: ReactNode }) {
  const items = useCdlFaq()
  if (!items.length) return null
  const structuredData = faqStructuredData(items.map(({ question, answer }) => ({ question, answer })))
  return (
    <Box component="section" id="faq" aria-labelledby="cdl-faq-title" sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f5f7fa', scrollMarginTop: 110 }}>
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      <Container maxWidth="md">
        <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing=".12em">Questions</Typography>
        <Typography id="cdl-faq-title" component="h2" variant="h3" color="primary.main" fontWeight={950} letterSpacing="-.035em" mt={0.5} mb={3}>
          Frequently asked questions
        </Typography>
        <FaqAccordions items={items} />
        {children}
      </Container>
    </Box>
  )
}
