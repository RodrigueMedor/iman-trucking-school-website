export type ElpResponses = { oral: string[]; signs: string[]; reading: string[]; log: Record<string, string>; defects: string; licenseExpiry: string }
export type ElpSection = { section: string; score: number; max: number; minimum: number; passed: boolean }
export type ElpEvaluation = { oralScores: number[]; signScores: number[]; readingScores: number[]; logScore: number; defectScore: number; licenseScore: number; criticalPassed: boolean[]; prohibitedAssistance: boolean; evaluatorName: string; evaluatorTitle: string; notes: string; evaluatedAt: string; sections: ElpSection[]; score: number; decision: 'PASS' | 'NOT YET QUALIFIED' }

export declare const oralQuestions: string[]
export declare const oralResponseChoices: string[]
export declare const trafficSigns: Array<{ name: string; image: string; critical: boolean; expected: string }>
export declare const readingPassage: string
export declare const readingQuestions: Array<{ prompt: string; max: number; choices: string[] }>
export declare const writtenChoices: {
  driverName: string[]; date: string[]; startLocation: string[]; destination: string[]; startTime: string[]; onDutyTime: string[]; defects: string[]; licenseExpiry: string[]
}
export declare const emptyResponses: ElpResponses
export declare function validateResponsesShape(value: unknown): value is ElpResponses
export declare function calculateEvaluation(input: Omit<ElpEvaluation, 'sections' | 'score' | 'decision' | 'evaluatedAt'>): ElpEvaluation
export declare function automaticallyEvaluate(responses: ElpResponses, evaluatorName: string, evaluatorTitle: string): ElpEvaluation
