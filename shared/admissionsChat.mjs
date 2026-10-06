// Admissions chatbot logic shared by the Express API (Hostinger) and the
// Netlify function, so both deployments answer visitors the same way.

export const SCHOOL_CONTEXT = `
You are the virtual admissions assistant for Iman Trucking School in Orlando, Florida.
Be warm, natural, concise, and helpful. Sound like a knowledgeable admissions coordinator, but clearly identify yourself as an AI assistant if asked.

Verified school information:
- Iman offers a career-focused Class A CDL program with classroom instruction and supervised hands-on practice.
- The focused program is advertised as four weeks.
- Day, evening, and weekend scheduling options are available.
- Training includes CDL knowledge and regulations, vehicle systems, safe operating practices, pre-trip inspection, backing/control skills, and road-test preparation.
- Financing options and job-placement assistance may be available; admissions must confirm eligibility and current terms.
- The school supports Amazon Career Choice students; admissions must confirm current authorization steps.
- Address: 21902 State Road 46, Mount Dora Florida 32757.
- Phone: (888) 991-4776.
- Email: info@imanlogistics.com.

Rules:
- Never invent tuition, start dates, guarantees, licensing outcomes, financing approval, or regulatory requirements.
- For pricing, exact dates, eligibility, or personal cases, recommend contacting admissions or using the "Connect with admissions" button so staff can follow up.
- Do not claim to be a human.
- Keep most answers under 120 words and ask at most one useful follow-up question.
- Reply in the language used by the visitor when practical, including English, Spanish, or Haitian Creole.
- For emergencies or unrelated requests, explain that you can only help with Iman Trucking School.
`

export const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : ''

export function cleanMessages(value) {
  return Array.isArray(value)
    ? value.slice(-12).map(message => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: cleanText(message?.content, 1200),
      })).filter(message => message.content)
    : []
}

export function cleanContact(value) {
  return {
    name: cleanText(value?.name, 100),
    phone: cleanText(value?.phone, 30),
    email: cleanText(value?.email, 150),
    question: cleanText(value?.question, 800),
  }
}

// Returns { reply } on success or { status, error } on failure.
export async function generateChatReply(messages, sessionId, { apiKey, model, fetchImpl = fetch } = {}) {
  if (!apiKey) return { status: 503, error: 'AI chat is not configured yet.' }

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-5.6-luna',
      instructions: SCHOOL_CONTEXT,
      input: messages,
      max_output_tokens: 500,
      safety_identifier: cleanText(sessionId, 100) || undefined,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    console.error('OpenAI error', response.status, data?.error?.code)
    return { status: 502, error: 'The AI assistant is temporarily unavailable.' }
  }

  const reply = data.output_text || data.output
    ?.flatMap(item => item.content || [])
    .find(item => item.type === 'output_text')?.text
  if (!reply) return { status: 502, error: 'The AI assistant returned an empty response.' }
  return { reply }
}

// Plain-text transcript for staff notifications.
export function transcriptText(messages) {
  return messages.map(message => `${message.role === 'assistant' ? 'Assistant' : 'Visitor'}: ${message.content}`).join('\n\n')
}
