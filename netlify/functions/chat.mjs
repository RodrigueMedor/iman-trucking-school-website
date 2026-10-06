import { cleanContact, cleanMessages, cleanText, generateChatReply } from '../../shared/admissionsChat.mjs'

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
})

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {})
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' })
  if ((event.body?.length ?? 0) > 25000) return json(413, { error: 'Request is too large.' })

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid request.' })
  }

  if (body.action === 'handoff') {
    const contact = cleanContact(body.contact)
    if (!contact.name || !contact.phone) return json(400, { error: 'Name and phone number are required.' })
    if (!process.env.GHL_WEBHOOK_URL) return json(503, { error: 'Online callback requests are not configured yet.' })

    const response = await fetch(process.env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Iman website AI chat',
        sessionId: cleanText(body.sessionId, 100),
        ...contact,
        submittedAt: new Date().toISOString(),
      }),
    })
    if (!response.ok) return json(502, { error: 'Admissions could not receive the request right now.' })
    return json(200, { ok: true })
  }

  if (body.action !== 'chat') return json(400, { error: 'Unknown action.' })

  const messages = cleanMessages(body.messages)
  if (!messages.length) return json(400, { error: 'Please enter a message.' })

  const result = await generateChatReply(messages, body.sessionId, {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  })
  if (result.error) return json(result.status, { error: result.error })
  return json(200, { reply: result.reply })
}
