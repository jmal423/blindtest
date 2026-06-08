'use client';

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('blindtest_debug') !== 'true') return false;

  try {
    const token = localStorage.getItem('blindtest_token');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export function setDebugMode(v: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('blindtest_debug', v ? 'true' : 'false');
}

let audioUnlocked = false;

export function isAudioUnlocked(): boolean {
  if (typeof window === 'undefined') return true;
  if (audioUnlocked) return true;
  if (sessionStorage.getItem('blindtest_audio_unlocked') === 'true') {
    audioUnlocked = true;
    return true;
  }
  return false;
}

export function unlockAudio(): boolean {
  if (typeof window === 'undefined') return false;
  if (audioUnlocked) return true;
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audio.volume = 0.01;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        audio.pause();
        audio.src = '';
        audioUnlocked = true;
        sessionStorage.setItem('blindtest_audio_unlocked', 'true');
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}