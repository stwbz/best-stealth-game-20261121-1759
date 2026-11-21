// Sound, synthesised with WebAudio and nothing else: no audio files, no
// network, no samples to load. Every effect is one short oscillator voice
// with an envelope, built on first use (after a gesture, so the browser
// allows it) and silent whenever audio is unavailable — the game never
// needs sound to be playable. Guard steps are panned left/right by where
// the guard stands relative to the thief, so the ears say what the eyes
// cannot: a guard is coming, and from which side.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensureContext() {
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
    const audio = ensureContext();
    if (audio !== null && audio.state === 'suspended') audio.resume().catch(() => {});
  }

  /**
   * One voice: an oscillator through a gain envelope, optionally panned.
   * `slideTo` glides the pitch; `pan` is -1 (left) to 1 (right). Any
   * failure is swallowed — audio is decoration, never load-bearing.
   */
  function voice({ frequency, slideTo, duration, type, volume, pan }) {
    if (muted) return;
    const audio = ensureContext();
    if (audio === null) return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (slideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      if (pan !== undefined && typeof audio.createStereoPanner === 'function') {
        const panner = audio.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
        gain.connect(panner);
        panner.connect(audio.destination);
      } else {
        gain.connect(audio.destination);
      }
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // A failed blip must never break the game.
    }
  }

  /** A note after `delayMs`, for the little win arpeggio. */
  function later(frequency, delayMs) {
    setTimeout(() => {
      voice({ frequency, duration: 0.24, type: 'sine', volume: 0.08 });
    }, delayMs);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    /** Soft tick as the thief walks; quieter and lower while sneaking. */
    footstep(sneaking) {
      voice({
        frequency: sneaking ? 150 : 205,
        duration: 0.05,
        type: 'triangle',
        volume: sneaking ? 0.02 : 0.04,
      });
    },
    /**
     * A guard's boot nearby: lower than the thief's step, panned toward
     * the guard, louder the closer it is. `pan` is -1..1 by direction.
     */
    guardStep(distance, pan) {
      voice({
        frequency: 85,
        duration: 0.08,
        type: 'sine',
        volume: Math.max(0.015, 0.085 * (1 - distance / 420)),
        pan,
      });
    },
    /** Bright two-note chime when a lantern shard is pocketed. */
    pickup() {
      voice({ frequency: 700, duration: 0.12, type: 'sine', volume: 0.09 });
      voice({ frequency: 1050, slideTo: 1400, duration: 0.18, type: 'sine', volume: 0.07 });
    },
    /** One soft tick as the meter crosses into suspicious. */
    suspicionTick() {
      voice({ frequency: 520, duration: 0.07, type: 'triangle', volume: 0.05 });
    },
    /** Rising two-note sting when the alarm goes up. */
    alertSting() {
      voice({ frequency: 240, slideTo: 480, duration: 0.16, type: 'sawtooth', volume: 0.07 });
      voice({ frequency: 360, slideTo: 720, duration: 0.22, type: 'sawtooth', volume: 0.05 });
    },
    /** Low thud when the thief is caught. */
    caughtThud() {
      voice({ frequency: 110, slideTo: 50, duration: 0.32, type: 'sine', volume: 0.12 });
    },
    /** Little rising arpeggio when the thief slips out unseen. */
    winFanfare() {
      [587, 740, 880, 1175].forEach((frequency, index) => later(frequency, index * 110));
    },
  };
}
