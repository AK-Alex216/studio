// src/app/page.tsx
'use client';

import type { NextPage } from 'next';
import { AudioRecorder } from '@/components/audio-recorder'; // Assuming AudioRecorder is in this path

const HomePage: NextPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <h1 className="text-4xl font-bold mb-8 text-foreground">NoiScript</h1>
      <p className="text-lg mb-8 text-muted-foreground text-center max-w-xl">
        Effortlessly convert speech to text with our advanced transcription system, designed for clarity even in noisy environments.
      </p>
      <AudioRecorder />
    </div>
  );
};

export default HomePage;
