import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-transcription.ts';
import '@/ai/flows/enhance-audio-clarity.ts';
import '@/ai/flows/transcribe-audio-flow.ts'; // Add import for the new flow
