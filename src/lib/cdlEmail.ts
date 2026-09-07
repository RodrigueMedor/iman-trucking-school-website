import { Resend } from 'resend'

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY || '')

export async function sendScoreEmail({
  recipient,
  studentName,
  assessment,
  score,
  totalPossible,
  grade,
  comments,
}: {
  recipient: string
  studentName: string
  assessment: string
  score: number
  totalPossible: number
  grade?: string
  comments?: string
}) {
  if (!import.meta.env.VITE_RESEND_API_KEY) {
    console.log('Mock email: Score notification would be sent to', recipient)
    return { success: true, messageId: 'mock-message-id' }
  }

  try {
    const percentage = Math.round((score / totalPossible) * 100)
    const { data, error } = await resend.emails.send({
      from: 'Iman Trucking School <noreply@imanlogistics.com>',
      to: recipient,
      subject: `Your ${assessment} Score`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #08085f;">Assessment Score Published</h2>
          <p>Dear ${studentName},</p>
          <p>Your score for <strong>${assessment}</strong> has been published:</p>
          <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #d61f2c;">
              ${score} / ${totalPossible} (${percentage}%)
            </p>
            ${grade ? `<p style="margin: 10px 0 0 0; font-weight: bold;">Grade: ${grade}</p>` : ''}
          </div>
          ${comments ? `<p><strong>Instructor Comments:</strong></p><p style="background: #fff3cd; padding: 15px; border-radius: 8px;">${comments}</p>` : ''}
          <p>If you have questions about your score, please contact your instructor.</p>
          <p>Best regards,<br>Iman Trucking School</p>
        </div>
      `,
    })

    if (error) throw error
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send score email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function sendResultEmail({
  recipient,
  studentName,
  resultNumber,
  score,
  classification,
  recommendations,
}: {
  recipient: string
  studentName: string
  resultNumber: string
  score: number
  classification: string
  recommendations: any
}) {
  if (!import.meta.env.VITE_RESEND_API_KEY) {
    console.log('Mock email: Result notification would be sent to', recipient)
    return { success: true, messageId: 'mock-message-id' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Iman Trucking School <noreply@imanlogistics.com>',
      to: recipient,
      subject: `CDL Readiness Assessment Result: ${resultNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #08085f;">CDL Readiness Assessment Complete</h2>
          <p>Dear ${studentName},</p>
          <p>Your CDL Readiness Assessment has been scored:</p>
          <div style="background: #f5f7fb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;"><strong>Result ID:</strong> ${resultNumber}</p>
            <p style="margin: 10px 0; font-size: 24px; font-weight: bold; color: #d61f2c;">
              Score: ${score}%
            </p>
            <p style="margin: 10px 0 0 0; font-weight: bold; color: #08085f;">
              Classification: ${classification}
            </p>
          </div>
          <p>This assessment measures English readiness for CDL training. Your results have been shared with authorized school personnel.</p>
          <p>Best regards,<br>Iman Trucking School</p>
        </div>
      `,
    })

    if (error) throw error
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('Failed to send result email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
