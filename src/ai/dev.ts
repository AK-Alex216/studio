import { config } from 'dotenv';
config();

import '@/ai/flows/transcribe-audio-flow.ts';

// Removed imports for flows that are no longer used or deleted:
// import '@/ai/flows/summarize-transcription.ts';
// import '@/ai/flows/enhance-audio-clarity.ts';
