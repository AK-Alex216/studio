'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, StopCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Check if the browser supports the SpeechRecognition API
const SpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isClient, setIsClient] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();

  // Ensure code runs only on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const initializeSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) {
      console.error('SpeechRecognition API not supported in this browser.');
      toast({
        title: 'Error',
        description: 'Speech recognition is not supported in this browser.',
        variant: 'destructive',
      });
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening even after pauses
    recognition.interimResults = true; // Get results as they come
    recognition.lang = 'en-US'; // Set language

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
      if (final) {
        setFinalTranscript((prev) => prev + final + ' '); // Append final results with a space
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      let description = `An error occurred: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        description = "Microphone access denied. Please allow microphone access in your browser settings.";
      } else if (event.error === 'no-speech') {
        description = "No speech detected. Please try speaking again.";
      } else if (event.error === 'network') {
        description = "Network error during speech recognition. Please check your connection.";
      } else if (event.error === 'audio-capture') {
        description = "Audio capture error. Please ensure your microphone is working.";
      }
      toast({
        title: 'Speech Recognition Error',
        description: description,
        variant: 'destructive',
      });
      setIsRecording(false); // Stop recording state on error
    };

    recognition.onend = () => {
       // Only reset if the user didn't manually stop
      if (isRecording && recognitionRef.current) {
         // If still recording, restart listening. This handles cases where the service might time out.
         try {
           recognitionRef.current.start();
         } catch (err) {
            // Handle potential errors if start() fails immediately after stop() was called.
            console.warn("Could not restart recognition immediately:", err);
            setIsRecording(false);
         }
      } else {
        setIsRecording(false); // Ensure state is updated if stopped manually or due to error
      }
    };

    return recognition;
  }, [toast, isRecording]); // Add isRecording to dependencies to correctly handle restart logic

  const startRecording = useCallback(() => {
    if (!isClient || !SpeechRecognition) return;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const recognition = initializeSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          setFinalTranscript(''); // Clear previous transcript
          setInterimTranscript('');
          setIsRecording(true);
          try {
            recognition.start();
            toast({
              title: 'Recording Started',
              description: 'Speak into your microphone.',
            });
          } catch (err) {
            console.error("Error starting recognition:", err);
            toast({
              title: 'Error',
              description: 'Could not start speech recognition.',
              variant: 'destructive',
            });
            setIsRecording(false);
          }
        }
      })
      .catch((err) => {
        console.error('Microphone access denied:', err);
        toast({
          title: 'Microphone Access Denied',
          description: 'Please allow microphone access in your browser settings.',
          variant: 'destructive',
        });
      });
  }, [isClient, initializeSpeechRecognition, toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript(''); // Clear interim transcript on stop
      toast({
        title: 'Recording Stopped',
        description: 'Transcription complete.',
      });
    }
  }, [isRecording, toast]);

  const downloadTranscript = () => {
    if (!finalTranscript) {
      toast({
        title: 'Nothing to Download',
        description: 'There is no transcription text to download.',
        variant: 'destructive',
      });
      return;
    }
    const blob = new Blob([finalTranscript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'noiscript_transcription.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Download Started',
      description: 'Transcription file is being downloaded.',
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    ); // Show loading state or placeholder during server render/hydration
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold text-primary">
            NoiScript
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative min-h-[200px] rounded-md border bg-secondary p-4">
            <Textarea
              readOnly
              value={finalTranscript + interimTranscript}
              placeholder="Transcription will appear here..."
              className="h-full w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-live="polite"
            />
            {isRecording && (
              <div className="absolute bottom-2 right-2 flex items-center space-x-1 text-xs text-muted-foreground animate-pulse">
                <div className="h-2 w-2 rounded-full bg-destructive animate-ping duration-1000"></div>
                <span>Listening...</span>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                aria-label="Start recording"
                disabled={!SpeechRecognition}
              >
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                aria-label="Stop recording"
              >
                <StopCircle className="mr-2 h-5 w-5" />
                Stop Recording
              </Button>
            )}
            <Button
              onClick={downloadTranscript}
              size="lg"
              variant="outline"
              disabled={!finalTranscript || isRecording}
              aria-label="Download transcription"
            >
              <Download className="mr-2 h-5 w-5" />
              Download
            </Button>
          </div>
          {!SpeechRecognition && (
             <p className="text-center text-sm text-destructive">
               Speech recognition is not supported by your browser. Please try Chrome or Edge.
             </p>
          )}
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground text-center justify-center">
           <p>Powered by Browser SpeechRecognition API.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
