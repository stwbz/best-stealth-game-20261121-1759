// Sound, synthesised with WebAudio and nothing else: no audio files, no
// network. Every sound is a short oscillator envelope, created on first use
// (after a user gesture, so browsers allow it) and silent when audio is
// unavailable — the game never depends on sound to be playable.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** Call from any user gesture so the browser unlocks audio. */
  function unlock() {
    const audio = ensure();
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      if (slideTo !== undefined) oscillator.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      // Audio is decoration; a failure here must never break the game.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** Soft tick as the player walks; quieter and lower when sneaking. */
    footstep(sneaking) {
      tone(sneaking ? 140 : 190, 0.05, 'triangle', sneaking ? 0.02 : 0.045);
    },
    /** A guard's boot nearby: lower, so it reads as someone else's step. */
    guardStep(distance) {
      const volume = Math.max(0.015, 0.09 * (1 - distance / 420));
      tone(95, 0.07, 'sine', volume);
    },
    /** Bright chime when a lantern shard is pocketed. */
    pickup() {
      tone(660, 0.12, 'sine', 0.09);
      tone(990, 0.18, 'sine', 0.07, 1320);
    },
    /** Rising two-note sting when the alarm goes up. */
    alertSting() {
      tone(220, 0.16, 'sawtooth', 0.08, 440);
      tone(330, 0.22, 'sawtooth', 0.06, 660);
    },
    /** Low thud when the player is caught. */
    caughtThud() {
      tone(120, 0.3, 'sine', 0.12, 55);
    },
    /** Little arpeggio when the player slips out unseen. */
    winFanfare() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        setTimeout(() => tone(frequency, 0.22, 'sine', 0.08), index * 110);
      });
    },
  };
}
