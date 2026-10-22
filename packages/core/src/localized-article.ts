import { z } from 'zod';
/** Public prose is its own reviewed revision, never an automatic projection of an English dossier. */
export const localizedArticleSchema = z.object({
  id: z.string().min(1), storyId: z.string().min(1), dossierVersion: z.number().int().positive(),
  version: z.number().int().positive(), language: z.enum(['es','en']), title: z.string().min(1),
  paragraphs: z.array(z.object({ text: z.string().min(1), claimIds: z.array(z.string().min(1)).min(1) })).min(1),
  aiDisclosure: z.string().min(1)
});
export type LocalizedArticle = z.infer<typeof localizedArticleSchema>;
