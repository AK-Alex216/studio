'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, StopCircle, Download, Loader2, Upload, FileAudio, Play, Pause, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow'; // Import the new flow
import { summarizeTranscription } from '@/ai/flows/summarize-transcription';

// Check if the browser supports the SpeechRecognition API
const SpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedAudioDataUri, setUploadedAudioDataUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Combined processing state
  const [isPlaying, setIsPlaying] = useState(false); // Audio playback state
  const [isSummarizing, setIsSummarizing] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Ensure code runs only on the client
  useEffect(() => {
    setIsClient(true);
    // Initialize audio element
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.onpause = () => setIsPlaying(false); // Handle pause as well
    audioRef.current.onerror = () => {
       setIsPlaying(false);
       toast({ title: "Audio Error", description: "Could not play the audio file.", variant: "destructive" });
    }

    // Cleanup audio element
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ''; // Release object URL/data URI
      }
    };
  }, [toast]);


  const initializeSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) {
      console.error('SpeechRecognition API not supported in this browser.');
      toast({
        title: 'Error',
        description: 'Live speech recognition is not supported in this browser.',
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
      setIsProcessing(false);
    };

    recognition.onend = () => {
       // Only reset if the user didn't manually stop or an error occured
      if (isRecording && recognitionRef.current) {
         // If still recording, restart listening. This handles cases where the service might time out.
         try {
           recognitionRef.current.start();
         } catch (err) {
            // Handle potential errors if start() fails immediately after stop() was called.
            console.warn("Could not restart recognition immediately:", err);
            setIsRecording(false);
            setIsProcessing(false);
         }
      } else {
        setIsRecording(false); // Ensure state is updated if stopped manually or due to error
        setIsProcessing(false);
      }
    };

    return recognition;
  }, [toast, isRecording]); // Add isRecording to dependencies to correctly handle restart logic

  const startRecording = useCallback(() => {
    if (!isClient || !SpeechRecognition || isProcessing || isRecording) return;
    if (uploadedFileName) {
      toast({
        title: 'Clear Upload First',
        description: 'Please clear the uploaded file before starting a new recording.',
        variant: 'destructive',
      });
      return;
    }


    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const recognition = initializeSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          setFinalTranscript(''); // Clear previous transcript
          setInterimTranscript('');
          setIsRecording(true);
          setIsProcessing(true); // Set processing state
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
            setIsProcessing(false);
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
  }, [isClient, initializeSpeechRecognition, toast, uploadedFileName, isProcessing, isRecording]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      // isRecording and isProcessing state are set to false in recognition.onend
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload an audio file.',
          variant: 'destructive',
        });
        setUploadedFileName(null);
        setUploadedAudioDataUri(null);
        if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
        return;
      }

      // Stop recording if it's active
      if (isRecording) {
        stopRecording();
      }
      setFinalTranscript(''); // Clear any existing transcript
      setInterimTranscript('');

      setIsProcessing(true); // Start loading indicator for file reading AND transcription
      setUploadedFileName('Processing...');
      setUploadedAudioDataUri(null); // Clear previous audio data

      const reader = new FileReader();
      reader.onloadend = async () => {
        const audioDataUri = reader.result as string;
        setUploadedAudioDataUri(audioDataUri);
        setUploadedFileName(file.name); // Set actual name after reading
        toast({
          title: 'File Uploaded',
          description: `Transcribing ${file.name}...`,
        });

        // --- Call Genkit Flow for Transcription ---
        try {
          const result = await transcribeAudio({ audioDataUri });
          if (result && result.transcription) {
             setFinalTranscript(result.transcription);
             toast({
               title: 'Transcription Successful',
               description: `Processed ${file.name}.`,
             });
          } else {
             throw new Error("Transcription result is empty or invalid.");
          }
        } catch (error) {
          console.error('Transcription error:', error);
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during transcription.';
          toast({
            title: 'Transcription Failed',
            description: errorMessage,
            variant: 'destructive',
          });
          setFinalTranscript(`Failed to transcribe: ${file.name}`); // Indicate failure in transcript area
        } finally {
          setIsProcessing(false); // End loading indicator regardless of success/failure
        }
        // -----------------------------------------
      };
      reader.onerror = () => {
        console.error('Error reading file');
        toast({
          title: 'File Read Error',
          description: 'Could not read the selected file.',
          variant: 'destructive',
        });
        setUploadedFileName(null);
        setUploadedAudioDataUri(null);
        setIsProcessing(false);
        if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
      };
      reader.readAsDataURL(file);
    }
     // Reset the input value so the same file can be selected again if needed
     if (event.target) {
      event.target.value = '';
    }
  };

  const triggerFileUpload = () => {
    if (isProcessing) return; // Prevent triggering upload while processing
    fileInputRef.current?.click();
  };

  const clearUpload = () => {
    setUploadedFileName(null);
    setUploadedAudioDataUri(null);
    setFinalTranscript('');
    setIsPlaying(false); // Stop playback if clearing
     if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
     toast({
        title: 'Upload Cleared',
        description: 'You can now record or upload a new file.',
      });
  }

   const togglePlayback = () => {
    if (!audioRef.current || !uploadedAudioDataUri) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.src = uploadedAudioDataUri; // Set source before playing
      audioRef.current.play().catch(err => {
          console.error("Error playing audio:", err);
           toast({ title: "Playback Error", description: "Could not play the audio file.", variant: "destructive" });
           setIsPlaying(false); // Ensure state is correct on error
      });
    }
     // Play() is async, state change might need slight delay or better handling with events
     // For simplicity, toggle state directly, but rely on events for accurate final state.
    setIsPlaying(!isPlaying);
  };

  const handleSummarize = async () => {
    if (!finalTranscript || isSummarizing) return;

    setIsSummarizing(true);
    toast({ title: 'Summarizing', description: 'Generating summary...' });

    try {
      const result = await summarizeTranscription({ transcription: finalTranscript });
      if (result && result.summary) {
        // Maybe display summary in a dialog or separate area? For now, append/replace.
        setFinalTranscript(`Summary:\n${result.summary}\n\nOriginal Transcription:\n${finalTranscript}`);
        toast({ title: 'Summary Generated', description: 'Summary added to the transcription.' });
      } else {
        throw new Error('Summarization result is empty.');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during summarization.';
      toast({ title: 'Summarization Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSummarizing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent restart logic after unmount
        recognitionRef.current.stop();
      }
       if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onpause = null;
        audioRef.current.onerror = null;
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

  const currentTranscript = finalTranscript + interimTranscript; // Always combine for display

  const placeholderText = uploadedFileName
    ? isProcessing ? `Processing: ${uploadedFileName}...` : `Transcription for ${uploadedFileName}. Ready for download or summary.`
    : isRecording ? "Listening..."
    : "Start recording or upload an audio file...";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold text-primary">
            NoiScript
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
           {/* Transcription Display Area */}
          <div className="relative min-h-[200px] rounded-md border bg-secondary p-4">
            <Textarea
              readOnly
              value={currentTranscript}
              placeholder={placeholderText}
              className="h-full w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-live="polite"
            />
            {(isRecording || isProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">
                  {isRecording ? "Listening..." : "Processing..."}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Recording Controls */}
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                aria-label="Start recording"
                disabled={!SpeechRecognition || !!uploadedFileName || isProcessing || isRecording}
              >
                <Mic className="mr-2 h-5 w-5" />
                Record
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                aria-label="Stop recording"
                disabled={!isRecording || isProcessing}
              >
                <StopCircle className="mr-2 h-5 w-5" />
                Stop
              </Button>
            )}

            {/* File Upload */}
             <Button
              onClick={triggerFileUpload}
              size="lg"
              variant="outline"
              disabled={isRecording || isProcessing}
              aria-label="Upload audio file"
            >
              <Upload className="mr-2 h-5 w-5" /> Upload File
            </Button>
             <Input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="hidden"
                id="audio-upload"
             />

             {/* Summarize Button */}
            <Button
              onClick={handleSummarize}
              size="lg"
              variant="outline"
              disabled={!finalTranscript || isSummarizing || isProcessing || isRecording}
              aria-label="Summarize transcription"
            >
              {isSummarizing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              Summarize
            </Button>


            {/* Download */}
            <Button
              onClick={downloadTranscript}
              size="lg"
              variant="outline"
              disabled={!finalTranscript || isProcessing || isRecording}
              aria-label="Download transcription"
            >
              <Download className="mr-2 h-5 w-5" />
              Download
            </Button>
          </div>

            {/* Uploaded File Info / Playback / Clear Button */}
           {uploadedFileName && !isProcessing && (
            <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
                     <Button onClick={togglePlayback} variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={!uploadedAudioDataUri}>
                       {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                       <span className="sr-only">{isPlaying ? 'Pause audio' : 'Play audio'}</span>
                    </Button>
                    <FileAudio className="h-4 w-4 shrink-0" />
                    <span className="truncate" title={uploadedFileName}>{uploadedFileName}</span>
                </div>
                <Button onClick={clearUpload} variant="ghost" size="sm" className="text-destructive hover:text-destructive/80 shrink-0">Clear</Button>
            </div>
            )}


          {!SpeechRecognition && (
             <p className="text-center text-sm text-destructive">
               Live speech recognition is not supported by your browser. Uploading files should still work.
             </p>
          )}
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground text-center justify-center pt-4 border-t">
           <p>Use live recording (Chrome/Edge recommended) or upload an audio file for transcription.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
