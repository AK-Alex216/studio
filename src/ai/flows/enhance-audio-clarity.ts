// src/ai/flows/enhance-audio-clarity.ts
'use server';

/**
 * @fileOverview An audio clarity enhancement AI agent.
 *
 * - enhanceAudioClarity - A function that handles the audio clarity enhancement process.
 * - EnhanceAudioClarityInput - The input type for the enhanceAudioClarity function.
 * - EnhanceAudioClarityOutput - The return type for the enhanceAudioClarity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceAudioClarityInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio recording as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EnhanceAudioClarityInput = z.infer<typeof EnhanceAudioClarityInputSchema>;

const EnhanceAudioClarityOutputSchema = z.object({
  enhancedAudioDataUri: z
    .string()
    .describe(
      'The enhanced audio recording as a data URI, with reduced background noise, that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' 
    ),
});
export type EnhanceAudioClarityOutput = z.infer<typeof EnhanceAudioClarityOutputSchema>;

export async function enhanceAudioClarity(input: EnhanceAudioClarityInput): Promise<EnhanceAudioClarityOutput> {
  return enhanceAudioClarityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhanceAudioClarityPrompt',
  input: {schema: EnhanceAudioClarityInputSchema},
  output: {schema: EnhanceAudioClarityOutputSchema},
  prompt: `You are an expert audio engineer specializing in noise reduction.

You will receive an audio recording, and you will return an enhanced version of the audio recording with reduced background noise.

Use the following as the primary source of information about the audio.

Audio: {{media url=audioDataUri}}

Respond ONLY with the enhanced audio data URI. Do not include any other text or explanation.`, // Keep it direct
});

const enhanceAudioClarityFlow = ai.defineFlow(
  {
    name: 'enhanceAudioClarityFlow',
    inputSchema: EnhanceAudioClarityInputSchema,
    outputSchema: EnhanceAudioClarityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {
      enhancedAudioDataUri: output!,
    };
  }
);
