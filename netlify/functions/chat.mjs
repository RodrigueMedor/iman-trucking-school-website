const SCHOOL_CONTEXT = `
You are the virtual admissions assistant for Iman Trucking School in Orlando, Florida.
Be warm, natural, concise, and helpful. Sound like a knowledgeable admissions coordinator, but clearly identify yourself as an AI assistant if asked.

Verified school information:
- Iman offers a career-focused Class A CDL program with classroom instruction and supervised hands-on practice.
- The focused program is advertised as four weeks.
- Day, evening, and weekend scheduling options are available.
- Training includes CDL knowledge and regulations, vehicle systems, safe operating practices, pre-trip inspection, backing/control skills, and road-test preparation.
- Financing options and job-placement assistance may be available; admissions must confirm eligibility and current terms.
- The school supports Amazon Career Choice students; admissions must confirm current authorization steps.
- Address: 5104 N Orange Blossom Trail, Suite 205, Orlando, FL 32810.
- Phone: (888) 991-4776.
- Email: info@imanlogistics.com.

Rules:
- Never invent tuition, start dates, guarantees, licensing outcomes, financing approval, or regulatory requirements.
- For pricing, exact dates, eligibility, or personal cases, recommend contacting admissions.
- Do not claim to be a human.
- Keep most answers under 120 words and ask at most one useful follow-up question.
- Reply in the language used by the visitor when practical, including English, Spanish, or Haitian Creole.
- For emergencies or unrelated requests, explain that you can only help with Iman Trucking School.
`

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

const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

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
    const contact = {
      name: cleanText(body.contact?.name, 100),
      phone: cleanText(body.contact?.phone, 30),
      email: cleanText(body.contact?.email, 150),
      question: cleanText(body.contact?.question, 800),
    }
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
  if (!process.env.OPENAI_API_KEY) return json(503, { error: 'AI chat is not configured yet.' })

  const messages = Array.isArray(body.messages)
    ? body.messages.slice(-12).map(message => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: cleanText(message?.content, 1200),
      })).filter(message => message.content)
    : []
  if (!messages.length) return json(400, { error: 'Please enter a message.' })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: SCHOOL_CONTEXT,
      input: messages,
      max_output_tokens: 500,
      safety_identifier: cleanText(body.sessionId, 100) || undefined,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    console.error('OpenAI error', response.status, data?.error?.code)
    return json(502, { error: 'The AI assistant is temporarily unavailable.' })
  }

  const reply = data.output_text || data.output
    ?.flatMap(item => item.content || [])
    .find(item => item.type === 'output_text')?.text
  if (!reply) return json(502, { error: 'The AI assistant returned an empty response.' })
  return json(200, { reply })
}
