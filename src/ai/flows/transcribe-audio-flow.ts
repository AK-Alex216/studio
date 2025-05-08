'use server';
/**
 * @fileOverview Transcribes audio data.
 *
 * - transcribeAudio - A function that handles the audio transcription.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "Audio data as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text from the audio.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

// Exported wrapper function
export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const transcribePrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: { schema: TranscribeAudioInputSchema },
  output: { schema: TranscribeAudioOutputSchema },
  prompt: `Please transcribe the audio provided accurately.
Audio: {{media url=audioDataUri}}
Respond with ONLY the transcribed text in the specified JSON format.`,
});

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (input) => {
    const llmResponse = await transcribePrompt(input);
    const output = llmResponse.output;
    if (!output) {
      const rawText = llmResponse.text;
      // Attempt to manually parse if model didn't strictly follow schema but gave text
      if (rawText && rawText.trim() !== '') {
        console.warn("LLM did not provide structured output, attempting to use raw text as transcription.");
        return { transcription: rawText.trim() };
      }
      throw new Error('Transcription failed: No output or parsable text from LLM.');
    }
    return output;
  }
);

