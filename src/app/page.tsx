'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, StopCircle, Download, Loader2, Upload, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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
  const [isProcessingUpload, setIsProcessingUpload] = useState(false); // To show loading for upload processing

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  }, [isClient, initializeSpeechRecognition, toast, uploadedFileName]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      // isRecording state is set to false in recognition.onend
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

      setIsProcessingUpload(true); // Start loading indicator
      setUploadedFileName('Processing...');

      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedAudioDataUri(reader.result as string);
        setUploadedFileName(file.name);
        setIsProcessingUpload(false); // End loading indicator
        toast({
          title: 'File Uploaded',
          description: `${file.name} is ready.`, // Add hint for next step if applicable
        });
         // TODO: Add logic here to automatically transcribe the uploaded file if desired
         // For now, just notify the user. Transcription needs a backend or different API.
         // Example: transcribeUploadedFile(reader.result as string);
         setFinalTranscript(`Uploaded file: ${file.name}\n(Transcription for uploaded files is not yet implemented)`);
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
        setIsProcessingUpload(false);
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
    fileInputRef.current?.click();
  };

  const clearUpload = () => {
    setUploadedFileName(null);
    setUploadedAudioDataUri(null);
    setFinalTranscript(''); // Clear the placeholder text
    if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
     toast({
        title: 'Upload Cleared',
        description: 'You can now record or upload a new file.',
      });
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent restart logic after unmount
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

  const currentTranscript = uploadedFileName
    ? finalTranscript // Show specific message for uploads
    : finalTranscript + interimTranscript; // Show live transcript for recording

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
              placeholder={
                uploadedFileName
                ? `Ready to process: ${uploadedFileName}`
                : "Start recording or upload an audio file..."

              }
              className="h-full w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-live="polite"
            />
            {isRecording && (
              <div className="absolute bottom-2 right-2 flex items-center space-x-1 text-xs text-muted-foreground animate-pulse">
                <div className="h-2 w-2 rounded-full bg-destructive animate-ping duration-1000"></div>
                <span>Listening...</span>
              </div>
            )}
             {isProcessingUpload && (
               <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
               </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Recording Controls */}
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                aria-label="Start recording"
                disabled={!SpeechRecognition || !!uploadedFileName || isProcessingUpload} // Disable if API not supported or file uploaded or processing
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
              disabled={isRecording || isProcessingUpload} // Disable if recording or processing
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


            {/* Download */}
            <Button
              onClick={downloadTranscript}
              size="lg"
              variant="outline"
              disabled={!finalTranscript || isRecording || uploadedFileName === 'Processing...'} // Disable if no text, recording, or processing upload
              aria-label="Download transcription"
            >
              <Download className="mr-2 h-5 w-5" />
              Download
            </Button>
          </div>

            {/* Uploaded File Info / Clear Button */}
           {uploadedFileName && !isProcessingUpload && (
            <div className="flex items-center justify-between p-2 border rounded-md bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileAudio className="h-4 w-4" />
                    <span className="truncate">{uploadedFileName}</span>
                </div>
                <Button onClick={clearUpload} variant="ghost" size="sm" className="text-destructive hover:text-destructive/80">Clear</Button>
            </div>
            )}


          {!SpeechRecognition && (
             <p className="text-center text-sm text-destructive">
               Live speech recognition is not supported by your browser. Uploading files might still work.
             </p>
          )}
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground text-center justify-center pt-4 border-t">
           <p>Use live recording (Chrome/Edge) or upload an audio file.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
