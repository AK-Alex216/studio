// src/components/audio-recorder.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mic, StopCircle, Upload, FileAudio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // Using camera permission state for mic
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const getMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasCameraPermission(true); // Re-using camera permission state name for microphone
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' }); // Adjust mime type if needed
        setAudioBlob(blob);
        audioChunks.current = []; // Clear chunks for next recording
        // Automatically transcribe after stopping recording
        handleTranscription(blob);
      };

      setMediaRecorder(recorder);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings.',
      });
    }
  }, [toast]);

  // Request permission on component mount
  useEffect(() => {
    getMicrophonePermission();
  }, [getMicrophonePermission]);


  const startRecording = () => {
    if (!mediaRecorder) {
        toast({ variant: "destructive", title: "Error", description: "MediaRecorder not initialized. Check permissions." });
        return;
    }
    if (hasCameraPermission === false) {
        toast({ variant: "destructive", title: "Permission Required", description: "Microphone access is needed to record." });
        getMicrophonePermission(); // Try requesting permission again
        return;
    }
    if (mediaRecorder.state === 'inactive') {
        audioChunks.current = []; // Reset chunks
        mediaRecorder.start();
        setIsRecording(true);
        setFinalTranscript(''); // Clear previous transcript
        setAudioBlob(null); // Clear previous blob
        toast({ title: "Recording Started", description: "Speak into your microphone." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setIsRecording(false);
        toast({ title: "Recording Stopped", description: "Processing audio..." });
        // Transcription will be handled by the onstop event listener
    }
  };

  const handleTranscription = async (blob: Blob | null) => {
    if (!blob) {
        toast({ variant: "destructive", title: "Error", description: "No audio data to transcribe." });
        return;
    }

    setIsTranscribing(true);
    setFinalTranscript('Transcribing...');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        if (!base64Audio) {
            throw new Error("Failed to convert audio to base64.");
        }

        const result = await transcribeAudio({ audioDataUri: base64Audio });
        setFinalTranscript(result.transcription || 'Transcription failed.');
        toast({ title: "Transcription Complete" });
      };
      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        throw new Error("Failed to read audio file.");
      }

    } catch (error) {
      console.error('Transcription error:', error);
      setFinalTranscript('Error during transcription.');
      toast({
        variant: 'destructive',
        title: 'Transcription Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

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

      setAudioBlob(file);
      setFinalTranscript(''); // Clear previous transcript
      setIsProcessingUpload(true); // Indicate processing start

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          if (!base64Audio) {
             throw new Error("Failed to read uploaded file.");
          }
          await handleTranscription(file); // Pass the file Blob directly
        } catch (error) {
          console.error("Error processing uploaded file:", error);
          setFinalTranscript(`Error processing file: ${file.name}`);
          toast({ variant: 'destructive', title: 'Upload Processing Failed'});
        } finally {
            setIsProcessingUpload(false); // Indicate processing end
        }
      };
      reader.onerror = () => {
          console.error("FileReader error on upload");
          setFinalTranscript(`Failed to read file: ${file.name}`);
          toast({ variant: 'destructive', title: 'File Read Error'});
          setIsProcessingUpload(false);
      }
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
        {hasCameraPermission === false && (
           <Alert variant="destructive">
              <AlertTitle>Microphone Access Required</AlertTitle>
              <AlertDescription>
                Please allow microphone access in your browser settings to use the recording feature. You can still upload files.
                <Button onClick={getMicrophonePermission} size="sm" className="ml-4">Retry Permissions</Button>
              </AlertDescription>
            </Alert>
        )}
         {hasCameraPermission === null && (
           <Alert>
              <AlertTitle>Requesting Permissions</AlertTitle>
              <AlertDescription>
                Waiting for microphone permissions...
              </AlertDescription>
            </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            onClick={startRecording}
            disabled={isRecording || hasCameraPermission !== true}
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
             disabled={isRecording || isTranscribing || isProcessingUpload}
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
            <span>Recording...</span>
            <Progress value={100} className="w-1/4 h-2 animate-pulse" />
          </div>
        )}

         {audioBlob && !isTranscribing && !isProcessingUpload && (
             <div className="space-y-2">
                 <p className="text-sm font-medium text-center">Audio Ready:</p>
                <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
                <Button
                    onClick={() => handleTranscription(audioBlob)}
                    disabled={isTranscribing}
                    className="w-full mt-2"
                    aria-label="Transcribe Recorded/Uploaded Audio"
                 >
                    {isTranscribing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       <FileAudio className="mr-2 h-4 w-4" />
                    )}
                    Transcribe Audio
                </Button>
            </div>
        )}


        {(isTranscribing || isProcessingUpload) && (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{isProcessingUpload ? 'Processing Upload...' : 'Transcribing...'}</span>
          </div>
        )}

        <Textarea
          value={finalTranscript}
          readOnly
          placeholder="Transcription will appear here..."
          className="min-h-[200px] text-base bg-muted/30 border rounded-md p-4 focus:ring-ring focus:ring-offset-2 focus:ring-2"
          aria-label="Transcription Output"
        />


      </CardContent>
    </Card>
  );
}
