// src/components/audio-recorder.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mic, StopCircle, Upload, AlertCircle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { transcribeAudio, type TranscribeAudioInput } from '@/ai/flows/transcribe-audio-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SpeechRecognition =
  (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition));


export function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingLive, setIsTranscribingLive] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
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
    const supported = !!SpeechRecognition;
    setIsSpeechRecognitionSupported(supported);
    if (!supported && hasMicrophonePermission !== false) {
      toast({
        variant: 'destructive',
        title: 'Browser Not Supported for Live Transcription',
        description: 'Your browser does not support the Web Speech API for live transcription. Uploading files will still attempt transcription.',
      });
    }
  }, [toast, hasMicrophonePermission]);


  const setupSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) return;

    const recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US';

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
            errorMsg = `An error occurred during live transcription: ${event.error}. File upload might still work.`
       }
      toast({ variant: 'destructive', title: 'Live Transcription Error', description: errorMsg });
      setIsRecording(false);
      setIsTranscribingLive(false);
    };

     recognizer.onstart = () => {
      setIsTranscribingLive(true);
    };

    recognizer.onend = () => {
      setIsTranscribingLive(false);
       if (isRecording && mediaRecorder?.state === 'recording' && recognition) {
         try {
            recognition.start();
         } catch (e) {
            console.warn("Could not restart recognition, stopping recording state.", e);
            setIsRecording(false); // Ensure state consistency
         }
       } else if (isRecording) {
         // If mediaRecorder is not recording or recognition is not set, ensure recording state is false
         setIsRecording(false);
       }
    };
    setRecognition(recognizer);
  }, [toast, isRecording, mediaRecorder?.state]); // Removed recognition from deps, it's set here

  const getMicrophonePermission = useCallback(async () => {
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        setHasMicrophonePermission(false);
        if (isSpeechRecognitionSupported) {
            toast({
                variant: 'destructive',
                title: 'Microphone API Not Available',
                description: 'Your browser does not support microphone access. Live recording is disabled.',
            });
        }
        return;
    }
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
        setAudioBlob(blob);
        audioChunks.current = [];
        if (recognition && isRecording) {
          try { recognition.stop(); } catch(e) { console.warn("Error stopping recognition on media stop", e); }
        }
        setIsRecording(false);
        setIsTranscribingLive(false);
      };

      setMediaRecorder(recorder);
      setupSpeechRecognition(); // Call setup after recorder is ready

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicrophonePermission(false);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings for live recording.',
      });
    }
  }, [toast, setupSpeechRecognition, isSpeechRecognitionSupported, recognition, isRecording]);

  useEffect(() => {
    if(hasMicrophonePermission === null) { // Only get permission if not already determined
        getMicrophonePermission();
    }
  }, [getMicrophonePermission, hasMicrophonePermission]);


  const startRecording = () => {
    if (!isSpeechRecognitionSupported) {
       toast({ variant: "destructive", title: "Live Transcription Not Supported", description: "Web Speech API not available in this browser. Try uploading a file." });
       return;
    }
     if (!mediaRecorder || !recognition) {
        toast({ variant: "destructive", title: "Initialization Error", description: "Audio components not initialized. Check permissions for live recording." });
        if (hasMicrophonePermission !== false) getMicrophonePermission(); // Retry if permission not explicitly denied
        return;
    }
    if (hasMicrophonePermission === false) {
        toast({ variant: "destructive", title: "Permission Required", description: "Microphone access is needed for live recording." });
        getMicrophonePermission();
        return;
    }
    if (mediaRecorder.state === 'inactive') {
        audioChunks.current = [];
        setFinalTranscript('');
        setInterimTranscript('');
        setAudioBlob(null);
        mediaRecorder.start();
        try { recognition.start(); } catch(e) {
            console.warn("Error starting recognition", e);
            setIsRecording(false);
            toast({variant: "destructive", title: "Live Transcription Start Failed", description: "Could not start live transcription."});
            return;
        }
        setIsRecording(true);
        toast({ title: "Recording Started", description: "Speak into your microphone. Transcription is live." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // This triggers recorder.onstop where recognition.stop() is also called
    } else if (recognition && isRecording) { // Ensure recognition stops if mediaRecorder was somehow already stopped
        try { recognition.stop(); } catch(e) { console.warn("Error stopping recognition on manual stop", e); }
    }
    setIsRecording(false);
    setIsTranscribingLive(false);
    if (mediaRecorder?.state !== 'inactive') { // Only toast if it was actually recording or trying to
        toast({ title: "Recording Stopped", description: "Live transcription ended." });
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an audio file.',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setIsProcessingUpload(true);
      setAudioBlob(file);
      setFinalTranscript('');
      setInterimTranscript('');
      toast({ title: 'Processing Upload', description: 'Transcribing your audio file...' });

      const reader = new FileReader();
      reader.onloadend = async () => {
        const audioDataUri = reader.result as string;
        try {
          const input: TranscribeAudioInput = { audioDataUri };
          const result = await transcribeAudio(input);
          setFinalTranscript(result.transcription);
          toast({
            variant: 'default',
            title: 'Transcription Complete',
            description: 'Uploaded file has been transcribed.',
          });
        } catch (transcriptionError) {
           console.error('Error transcribing uploaded file:', transcriptionError);
           const errorMsg = transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError);
           toast({
              variant: 'destructive',
              title: 'Upload Transcription Failed',
              description: `An error occurred: ${errorMsg}. Please ensure Genkit is configured with a Speech-to-Text capable model.`,
           });
           setFinalTranscript('(Transcription failed for uploaded file)');
        } finally {
          setIsProcessingUpload(false);
        }
      };
      reader.onerror = () => {
        console.error("File reading error");
        toast({ variant: "destructive", title: "File Read Error", description: "Could not read the uploaded file." });
        setIsProcessingUpload(false);
      };
      reader.readAsDataURL(file);
    }
     if (fileInputRef.current) {
        fileInputRef.current.value = '';
     }
  };

  const triggerFileUpload = () => {
    if (isRecording) {
        toast({variant: "default", description: "Please stop recording before uploading a file."});
        return;
    }
    if (isProcessingUpload) {
        toast({variant: "default", description: "File upload already in progress."});
        return;
    }
    fileInputRef.current?.click();
  };

  const copyToClipboard = useCallback(() => {
    const textToCopy = finalTranscript + interimTranscript;
    if (!textToCopy.trim()) {
        toast({ description: "Nothing to copy." });
        return;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          toast({ title: "Copied!", description: "Transcription copied to clipboard." });
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard using modern API." });
        });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed"; // Prevent scrolling to bottom of page in MS Edge.
      textArea.style.top = "0";
      textArea.style.left = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
            toast({ title: "Copied!", description: "Transcription copied to clipboard (fallback)." });
        } else {
            toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard using fallback." });
        }
      } catch (err) {
        console.error('Fallback copy failed: ', err);
        toast({ variant: "destructive", title: "Copy Failed", description: "Error during fallback copy." });
      }
      document.body.removeChild(textArea);
    }
  }, [finalTranscript, interimTranscript, toast]);


  return (
    <Card className="w-full max-w-2xl shadow-lg">
       <CardHeader>
        <CardTitle className="text-center text-2xl font-semibold">Audio Transcription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isSpeechRecognitionSupported && hasMicrophonePermission !== false && (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Live Transcription Not Supported</AlertTitle>
              <AlertDescription>
                Your browser does not support the Web Speech API for live transcription (e.g., try Chrome or Edge).
                You can still upload audio files for transcription.
              </AlertDescription>
            </Alert>
        )}
        {hasMicrophonePermission === false && (
           <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Microphone Access Required</AlertTitle>
              <AlertDescription>
                Please allow microphone access in your browser settings for live recording.
                <Button onClick={getMicrophonePermission} size="sm" className="ml-4 mt-2 sm:mt-0">Retry Permissions</Button>
              </AlertDescription>
            </Alert>
        )}
         {hasMicrophonePermission === null && (
           <Alert>
               <AlertCircle className="h-4 w-4" />
              <AlertTitle>Requesting Permissions</AlertTitle>
              <AlertDescription>
                Waiting for microphone permissions for live recording... If this persists, please check your browser settings.
              </AlertDescription>
            </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button
            onClick={startRecording}
            disabled={isRecording || hasMicrophonePermission !== true || !isSpeechRecognitionSupported || isProcessingUpload || !mediaRecorder || !recognition}
            className="w-full sm:w-auto"
            aria-label="Start Live Recording and Transcription"
          >
            <Mic className="mr-2 h-4 w-4" /> Start Live
          </Button>
          <Button
            onClick={stopRecording}
            disabled={!isRecording}
            variant="destructive"
            className="w-full sm:w-auto"
            aria-label="Stop Live Recording and Transcription"
          >
            <StopCircle className="mr-2 h-4 w-4" /> Stop Live
          </Button>
           <Button
             onClick={triggerFileUpload}
             disabled={isRecording || isProcessingUpload}
             variant="outline"
             className="w-full sm:w-auto"
             aria-label="Upload Audio File for Transcription"
           >
            {isProcessingUpload ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Upload className="mr-2 h-4 w-4" />
            )}
            Upload & Transcribe
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            style={{ display: 'none' }}
            id="audio-upload-input"
            aria-hidden="true"
          />
        </div>

        {(isRecording || isTranscribingLive) && (
          <div className="flex items-center justify-center space-x-2 text-destructive animate-pulse">
            <Mic className="h-5 w-5" />
            <span>{isRecording ? 'Recording...' : ''} {isTranscribingLive ? '(Transcribing Live)' : ''}</span>
            {isRecording && <Progress value={100} className="w-1/4 h-2 animate-pulse" />}
          </div>
        )}
        
         {isProcessingUpload && (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Transcribing Uploaded File...</span>
          </div>
        )}

         {audioBlob && !isRecording && !isProcessingUpload && (
             <div className="space-y-2">
                 <p className="text-sm font-medium text-center">Last Recorded / Uploaded Audio:</p>
                <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" aria-label="Audio Playback Controls" />
            </div>
        )}
        
        <div className="relative">
            <Textarea
              value={finalTranscript + interimTranscript}
              readOnly
              placeholder={
                isSpeechRecognitionSupported || hasMicrophonePermission === false ?
                "Transcription will appear here. Start live recording or upload an audio file." :
                "Enable microphone or use a supported browser for live transcription. You can still upload files."
              }
              className="min-h-[200px] text-base bg-muted/30 border rounded-md p-4 pr-12 focus:ring-ring focus:ring-offset-2 focus:ring-2"
              aria-label="Transcription Output"
              aria-live="polite"
            />
            <Button
                variant="ghost"
                size="icon"
                onClick={copyToClipboard}
                className="absolute top-2 right-2"
                aria-label="Copy transcription to clipboard"
                disabled={!finalTranscript.trim() && !interimTranscript.trim()}
            >
                <Copy className="h-4 w-4" />
            </Button>
        </div>

      </CardContent>
    </Card>
  );
}
