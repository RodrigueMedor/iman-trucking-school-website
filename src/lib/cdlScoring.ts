export const classifications = {
  ready: { en: 'Ready for CDL Training', ht: 'Pare pou Fòmasyon CDL' },
  support: { en: 'Ready with Additional English Support', ht: 'Pare avèk Sipò Anglè Anplis' },
  preparation: {
    en: 'English Preparation Required Before CDL Training',
    ht: 'Preparasyon Anglè Obligatwa Anvan Fòmasyon CDL',
  },
} as const

export function classifyScore(score: number, ready = 80, support = 65) {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('Invalid score')
  return score >= ready ? classifications.ready : score >= support ? classifications.support : classifications.preparation
}

export function calculateScore(answered: { answerChoiceId: string }[], correctChoiceIds: Set<string>) {
  const correct = answered.reduce((sum, response) => sum + Number(correctChoiceIds.has(response.answerChoiceId)), 0)
  return { correct, incorrect: 50 - correct, score: correct * 2, percentage: correct * 2 }
}
