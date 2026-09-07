import { z } from 'zod'

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  answerChoiceId: z.string().uuid(),
})

export const registrationSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(10).regex(/[A-Z]/).regex(/[0-9]/),
  consent: z.literal(true),
})

export const scoreSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  courseId: z.string().uuid('Invalid course ID format'),
  sessionId: z.string().uuid('Invalid session ID format'),
  assessment: z.string().trim().min(2).max(120),
  assessmentAt: z.coerce.date(),
  score: z.coerce.number().min(0),
  totalPossible: z.coerce.number().positive(),
  grade: z.string().trim().max(12).optional(),
  comments: z.string().trim().max(1000).optional(),
}).refine(x => x.score <= x.totalPossible, {
  message: 'Score cannot exceed total possible score',
  path: ['score'],
})

export const applicationSchema = z.object({
  courseId: z.string().uuid('Invalid course ID format'),
  sessionId: z.string().uuid('Invalid session ID format'),
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().email(),
  phone: z.string().trim().max(30).optional(),
  statement: z.string().trim().max(1500).optional(),
})

export const applicationReviewSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  staffNotes: z.string().trim().max(1500).optional(),
})

export const enrollmentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
  courseId: z.string().uuid('Invalid course ID format'),
  sessionId: z.string().uuid('Invalid session ID format'),
})
