// src/ai/flows/summarize-transcription.ts
'use server';

/**
 * @fileOverview Summarizes a long transcription using GenAI.
 *
 * - summarizeTranscription - A function that summarizes the transcription.
 * - SummarizeTranscriptionInput - The input type for the summarizeTranscription function.
 * - SummarizeTranscriptionOutput - The return type for the summarizeTranscription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeTranscriptionInputSchema = z.object({
  transcription: z
    .string()
    .describe('The transcription text to summarize.'),
});
export type SummarizeTranscriptionInput = z.infer<typeof SummarizeTranscriptionInputSchema>;

const SummarizeTranscriptionOutputSchema = z.object({
  summary: z.string().describe('The summarized transcription text.'),
});
export type SummarizeTranscriptionOutput = z.infer<typeof SummarizeTranscriptionOutputSchema>;

export async function summarizeTranscription(
  input: SummarizeTranscriptionInput
): Promise<SummarizeTranscriptionOutput> {
  return summarizeTranscriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeTranscriptionPrompt',
  input: {schema: SummarizeTranscriptionInputSchema},
  output: {schema: SummarizeTranscriptionOutputSchema},
  prompt: `Summarize the following transcription:\n\nTranscription: {{{transcription}}}`,
});

const summarizeTranscriptionFlow = ai.defineFlow(
  {
    name: 'summarizeTranscriptionFlow',
    inputSchema: SummarizeTranscriptionInputSchema,
    outputSchema: SummarizeTranscriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
