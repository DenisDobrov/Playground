import type { ReleaseBundle, Source } from './index';

export const demoSource: Source = {
  id: 'source-demo', canonicalId: 'fixture:demo-001', url: 'https://example.org/demo-paper',
  titleEn: 'Synthetic example: evaluating a model under a fixed protocol',
  kind: 'paper', peerReviewed: false, fullTextAvailable: true, license: null
};
export const demoBundle: ReleaseBundle = {
  story: {
    id: 'story-demo', slug: 'como-leer-un-resultado-de-ia',
    titleEn: 'Demo: how to read a model evaluation', titleEs: 'Cómo leer un resultado de IA sin confundirlo con una promesa',
    domainIds: ['ai'], score: 82, scoreReasonEn: 'Fixture score for UI demonstration, not an evaluated real research result.',
    status: 'review', sourceIds: ['source-demo'], conceptQids: ['Q11660']
  },
  dossier: {
    storyId: 'story-demo', summaryEn: 'Synthetic fixture for exercising the newsroom workflow.',
    methodologyEn: ['A fictional fixed benchmark protocol.'], limitationsEn: ['Not real research; no scientific conclusions can be drawn.'],
    authorsDoNotClaimEn: ['General intelligence or real-world reliability.'], openQuestionsEn: ['Would an independent evaluation reproduce the result?'],
    claims: [{ id: 'claim-demo', textEn: 'In this synthetic example, performance depends on the evaluation protocol.', type: 'editorial_explanation', domainId: 'ai', evidenceLevel: 'A1', status: 'unverified', evidenceIds: ['evidence-demo'], caveatEn: 'Synthetic data. Not independently verified.' }],
    evidence: [{ id: 'evidence-demo', sourceId: 'source-demo', quote: 'Synthetic fixture: results are defined only for this evaluation protocol.', locator: 'Demo fixture, paragraph 1', sourceUrl: 'https://example.org/demo-paper', accessedAt: '2026-10-21T00:00:00Z' }]
  },
  article: {
    id: 'article-demo', storyId: 'story-demo', version: 1, language: 'es',
    title: 'Cómo leer un resultado de IA sin confundirlo con una promesa',
    paragraphs: [{ textEs: 'Un resultado depende de cómo se evalúa. Antes de comparar modelos, hay que conocer el protocolo y sus límites.', claimIds: ['claim-demo'] }, { textEs: 'Este ejemplo no demuestra fiabilidad fuera del protocolo. La evaluación independiente sigue pendiente.', claimIds: ['claim-demo'] }],
    aiDisclosureEs: 'Demostración con datos ficticios. Borrador asistido por IA; no es una noticia publicada.'
  },
  script: { id: 'script-demo', storyId: 'story-demo', version: 1, language: 'es', scenes: [
    { id: 'scene-1', narrationEs: 'Un resultado de inteligencia artificial depende de cómo se evalúa.', durationSeconds: 8, claimIds: ['claim-demo'], visual: 'diagram', visualDescription: 'Protocolo → evaluación → resultado' },
    { id: 'scene-2', narrationEs: 'Conocer los límites es tan importante como conocer la puntuación.', durationSeconds: 8, claimIds: ['claim-demo'], visual: 'text', visualDescription: 'Método · Evidencia · Límites' }
  ] },
  assets: [], languageCheckPassed: false, independentVerificationPassed: false
};
