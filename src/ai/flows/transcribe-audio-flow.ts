// src/ai/flows/transcribe-audio-flow.ts
'use server';

/**
 * @fileOverview Transcribes audio using GenAI.
 *
 * - transcribeAudio - A function that transcribes the audio.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text from the audio.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const prompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  input: {schema: TranscribeAudioInputSchema},
  output: {schema: TranscribeAudioOutputSchema},
  prompt: `Transcribe the following audio recording accurately. Ignore any background noise if possible and focus on the speech content.

Audio: {{media url=audioDataUri}}

Respond ONLY with the transcribed text. Do not include any other information, explanations, or formatting.`,
});

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async input => {
    // Use a model known for good transcription, like Gemini 1.5 Flash if available
    // or stick to the default configured model if it supports audio input well.
    // Adjust model if needed: model: 'googleai/gemini-1.5-flash'
    const {output} = await prompt(input);

    if (!output) {
      throw new Error('Transcription failed: No output received from the model.');
    }
    // Ensure the output structure matches the schema, even if the model only returns a string
    if (typeof output === 'string') {
       return { transcription: output };
    }
    return output;
  }
);
