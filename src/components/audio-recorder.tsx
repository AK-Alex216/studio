// src/components/audio-recorder.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mic, StopCircle, Upload, FileAudio, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// Removed Genkit import: import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Check for SpeechRecognition API availability
const SpeechRecognition =
  (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition));


export function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false); // Used for Web Speech API processing state
  const [isProcessingUpload, setIsProcessingUpload] = useState(false); // Keep for upload UX
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null); // Keep for potential playback of recording/upload
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState<boolean | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setIsSpeechRecognitionSupported(!!SpeechRecognition);
    if (!SpeechRecognition) {
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported',
        description: 'Your browser does not support the Web Speech API for transcription.',
      });
    }
  }, [toast]);


  const setupSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US'; // You can make this configurable

    recognizer.onresult = (event) => {
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
      // Append final results to the final transcript
      if (final) {
        setFinalTranscript((prev) => prev + final + ' ');
      }
    };

    recognizer.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
       let errorMsg = event.error;
       if (errorMsg === 'no-speech') {
           errorMsg = 'No speech detected. Please try speaking louder or closer to the microphone.';
       } else if (errorMsg === 'audio-capture') {
           errorMsg = 'Microphone not available. Check if another app is using it.';
       } else if (errorMsg === 'not-allowed') {
           errorMsg = 'Microphone permission denied. Please allow access.';
       } else {
            errorMsg = `An error occurred: ${event.error}`
       }
      toast({ variant: 'destructive', title: 'Transcription Error', description: errorMsg });
      setIsRecording(false); // Stop recording state on error
      setIsTranscribing(false);
    };

     recognizer.onstart = () => {
      setIsTranscribing(true); // Indicate transcription is active
    };

    recognizer.onend = () => {
      setIsTranscribing(false); // Indicate transcription stopped
       if (isRecording) {
         // If it ended unexpectedly while we still think we're recording, try restarting
         console.log("Speech recognition ended unexpectedly, restarting...");
         // Only restart if we are logically still recording
         if(mediaRecorder?.state === 'recording') {
             recognizer.start();
         } else {
             setIsRecording(false); // Ensure state consistency
         }
       }
    };

    setRecognition(recognizer);
  }, [toast, isRecording, mediaRecorder?.state]); // Added dependencies

  const getMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicrophonePermission(true);
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob); // Save the blob for potential playback
        audioChunks.current = [];
        // Stop speech recognition when recording stops
        if (recognition && isRecording) {
          recognition.stop();
        }
        setIsRecording(false); // Ensure recording state is updated
        setIsTranscribing(false); // Ensure transcribing state is updated
      };

      setMediaRecorder(recorder);
      // Setup Speech Recognition after getting permission and recorder
      setupSpeechRecognition();

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicrophonePermission(false);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings.',
      });
    }
  }, [toast, setupSpeechRecognition, recognition, isRecording]); // Added dependencies

  // Request permission on component mount
  useEffect(() => {
    getMicrophonePermission();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  const startRecording = () => {
    if (!isSpeechRecognitionSupported) {
       toast({ variant: "destructive", title: "Not Supported", description: "Web Speech API not available in this browser." });
       return;
    }
     if (!mediaRecorder || !recognition) {
        toast({ variant: "destructive", title: "Error", description: "Audio components not initialized. Check permissions." });
        getMicrophonePermission(); // Try initializing again
        return;
    }
    if (hasMicrophonePermission === false) {
        toast({ variant: "destructive", title: "Permission Required", description: "Microphone access is needed to record." });
        getMicrophonePermission(); // Try requesting permission again
        return;
    }
    if (mediaRecorder.state === 'inactive') {
        audioChunks.current = []; // Reset chunks
        setFinalTranscript(''); // Clear previous final transcript
        setInterimTranscript(''); // Clear previous interim transcript
        setAudioBlob(null); // Clear previous blob
        mediaRecorder.start();
        recognition.start(); // Start speech recognition
        setIsRecording(true);
        toast({ title: "Recording Started", description: "Speak into your microphone. Transcription is live." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // This will trigger recorder.onstop
        // recognition.stop() is called within recorder.onstop to ensure it happens after blob creation
        toast({ title: "Recording Stopped", description: "Processing final audio..." });
    }
     if (recognition && isRecording) { // Ensure recognition stops if mediaRecorder was already stopped somehow
        recognition.stop();
    }
    setIsRecording(false); // Explicitly set recording state to false
    setIsTranscribing(false); // Explicitly set transcribing state to false
  };


  // Transcription is now handled live by the Web Speech API (recognition.onresult)
  // handleTranscription function removed as Genkit is no longer used for this.

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an audio file.',
        });
        return;
      }

      setIsProcessingUpload(true); // Indicate processing start
      setAudioBlob(file); // Set blob for playback
      setFinalTranscript(''); // Clear transcript area
      setInterimTranscript('');

      // Simulate processing, then show alert about lack of file transcription
      setTimeout(() => {
         toast({
           variant: 'default',
           title: 'File Uploaded',
           description: 'You can play the uploaded file. Live transcription only works with microphone input in this version.',
         });
         setIsProcessingUpload(false); // Indicate processing end
      }, 500); // Short delay for UX

      // Removed transcription logic for uploaded files
    }
     // Reset file input value to allow uploading the same file again
     if (fileInputRef.current) {
        fileInputRef.current.value = '';
     }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };


  return (
    <Card className="w-full max-w-2xl shadow-lg">
       <CardHeader>
        <CardTitle className="text-center text-2xl font-semibold">Audio Transcription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isSpeechRecognitionSupported && (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Browser Not Supported</AlertTitle>
              <AlertDescription>
                Live transcription requires the Web Speech API, which is not available in your current browser. Try Chrome or Edge. File upload is still available for playback.
              </AlertDescription>
            </Alert>
        )}
        {hasMicrophonePermission === false && (
           <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Microphone Access Required</AlertTitle>
              <AlertDescription>
                Please allow microphone access in your browser settings to use the recording feature. You can still upload files for playback.
                <Button onClick={getMicrophonePermission} size="sm" className="ml-4">Retry Permissions</Button>
              </AlertDescription>
            </Alert>
        )}
         {hasMicrophonePermission === null && isSpeechRecognitionSupported && (
           <Alert>
               <AlertCircle className="h-4 w-4" />
              <AlertTitle>Requesting Permissions</AlertTitle>
              <AlertDescription>
                Waiting for microphone permissions...
              </AlertDescription>
            </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            onClick={startRecording}
            disabled={isRecording || hasMicrophonePermission !== true || !isSpeechRecognitionSupported || !mediaRecorder || !recognition}
            className="w-full sm:w-auto"
            aria-label="Start Recording"
          >
            <Mic className="mr-2 h-4 w-4" /> Start Recording
          </Button>
          <Button
            onClick={stopRecording}
            disabled={!isRecording}
            variant="destructive"
            className="w-full sm:w-auto"
             aria-label="Stop Recording"
          >
            <StopCircle className="mr-2 h-4 w-4" /> Stop Recording
          </Button>
           <Button
             onClick={triggerFileUpload}
             disabled={isRecording || isProcessingUpload} // Only disable during recording/upload processing
             variant="outline"
             className="w-full sm:w-auto"
             aria-label="Upload Audio File"
           >
            {isProcessingUpload ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Upload className="mr-2 h-4 w-4" />
            )}
            Upload File
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            style={{ display: 'none' }}
          />
        </div>

        {isRecording && (
          <div className="flex items-center justify-center space-x-2 text-destructive animate-pulse">
            <Mic className="h-5 w-5" />
            <span>Recording... {isTranscribing ? '(Transcribing Live)' : ''}</span>
            <Progress value={100} className="w-1/4 h-2 animate-pulse" />
          </div>
        )}

         {audioBlob && !isRecording && ( // Show audio player when not recording and blob exists
             <div className="space-y-2">
                 <p className="text-sm font-medium text-center">Last Recording / Uploaded Audio:</p>
                <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
                {/* Removed Transcribe button as it's live or not supported for uploads */}
            </div>
        )}


        {(isTranscribing && !isRecording) && ( // Show only when explicitly transcribing *after* stopping, unlikely with live API
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing Final Transcript...</span>
          </div>
        )}
         {isProcessingUpload && ( // Show only when processing upload
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing Upload...</span>
          </div>
        )}


        <Textarea
          value={finalTranscript + interimTranscript} // Show both final and interim results
          readOnly
          placeholder="Transcription will appear here live during recording..."
          className="min-h-[200px] text-base bg-muted/30 border rounded-md p-4 focus:ring-ring focus:ring-offset-2 focus:ring-2"
          aria-label="Transcription Output"
        />


      </CardContent>
    </Card>
  );
}
