import { Component, ChangeDetectionStrategy, signal, computed, OnDestroy, WritableSignal, Signal } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnDestroy {
  isRecording: WritableSignal<boolean> = signal(false);
  isPlaying: WritableSignal<boolean> = signal(false);
  audioURL: WritableSignal<string | null> = signal(null);
  errorMessage: WritableSignal<string | null> = signal(null);
  recordingTime: WritableSignal<number> = signal(0);
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  private timerInterval: any = null;
  private playAfterStopping = false;
  private audio: HTMLAudioElement | null = null;

  formattedRecordingTime: Signal<string> = computed(() => {
    const totalSeconds = this.recordingTime();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${this.padZero(minutes)}:${this.padZero(seconds)}`;
  });

  async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    this.resetState();
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.isRecording.set(true);
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        this.audioURL.set(audioUrl);
        this.audioChunks = [];
        this.stopMediaStream();

        // Clear previous audio element to load the new recording
        if (this.audio) {
          this.audio = null;
        }

        if (this.playAfterStopping) {
          this.playAfterStopping = false;
          this._playAudio();
        }
      };
      this.mediaRecorder.start();
      this.startTimer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      this.errorMessage.set('Could not access microphone. Please ensure permissions are granted.');
      this.isRecording.set(false);
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.stopTimer();
    }
  }

  handlePlaybackClick(): void {
    if (this.isRecording()) {
      this.playAfterStopping = true;
      this.stopRecording();
    } else if (this.isPlaying()) {
      this.stopPlayback();
    } else {
      this._playAudio();
    }
  }

  private _playAudio(): void {
    const audioUrl = this.audioURL();
    if (audioUrl) {
      if (!this.audio) {
        this.audio = new Audio(audioUrl);
        this.audio.onended = () => {
          this.isPlaying.set(false);
        };
      }
      this.audio.play();
      this.isPlaying.set(true);
    }
  }
  
  private stopPlayback(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.isPlaying.set(false);
  }

  deleteAudio(): void {
    this.resetState();
  }
  
  private resetState(): void {
    this.stopPlayback();
    this.audio = null;
    const audioUrl = this.audioURL();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    this.audioURL.set(null);
    this.recordingTime.set(0);
    this.errorMessage.set(null);
    this.playAfterStopping = false;
  }

  private startTimer(): void {
    this.recordingTime.set(0);
    this.timerInterval = setInterval(() => {
      this.recordingTime.update(time => time + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  private stopMediaStream(): void {
    if(this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
    }
  }

  private padZero(num: number): string {
    return num.toString().padStart(2, '0');
  }

  ngOnDestroy(): void {
    this.stopRecording();
    this.resetState();
    this.stopMediaStream();
  }
}