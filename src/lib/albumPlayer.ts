/**
 * Playback of memoryrot's album (album.ts) for the hall's CD player and its track menu: one audio element per visit.
 * It lives outside the 3D scene, so a hall rebuilt after a lost WebGL context (Stage3D) keeps the music going.
 * Volume runs through a gain node when Web Audio is there (Safari ignores a media element's volume), and the
 * analyser that drives the player's display listens before it, so a quiet setting does not flatten the spectrum.
 * The system's media controls (keyboard keys, the OS overlay) get the track, the album and its buttons.
 */
import { album } from './album';

export type PlayState = 'stopped' | 'playing' | 'paused';

/** Volume steps as a CD player's display counts them. */
export const VOLUME_STEPS = 10;
const GAIN = (step: number) => Math.pow(step / VOLUME_STEPS, 1.6);

class AlbumPlayer {
  state: PlayState = 'stopped';
  track = 0;
  volume = 8;
  /** A track did not load: the player hands over to Spotify (cdPlayer.ts). */
  failed = false;
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private gain?: GainNode;
  private analyser?: AnalyserNode;
  private bins?: Uint8Array<ArrayBuffer>;
  private playRequest = 0;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  get elapsed() {
    return this.audio && this.state !== 'stopped' ? this.audio.currentTime : 0;
  }

  play(index = this.track) {
    if (this.failed) return;
    const audio = this.ensureAudio();
    if (index !== this.track || !audio.getAttribute('src')) {
      this.track = index;
      audio.src = album.tracks[index].src;
    }
    // Created and resumed inside the click: browsers only let a gesture start audio.
    void this.context?.resume().catch(() => {});
    this.state = 'playing';
    const request = ++this.playRequest;
    audio.play().catch(() => {
      // A source change cancels older play promises; they must not stop the newest track's display.
      if (this.audio !== audio || this.playRequest !== request || this.state !== 'playing') return;
      this.state = 'stopped';
      this.emit();
    });
    this.emit();
  }

  toggle() {
    if (this.state === 'playing') this.pause();
    else this.play();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.playRequest++;
    this.audio?.pause();
    this.state = 'paused';
    this.emit();
  }

  stop() {
    if (this.state === 'stopped') return;
    this.playRequest++;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.state = 'stopped';
    this.emit();
  }

  /** Past the last track it starts over at the first, as a CD player does on repeat. */
  next() {
    const index = (this.track + 1) % album.tracks.length;
    if (this.state === 'playing') this.play(index);
    else this.cue(index);
  }

  /** More than three seconds in: back to the start of this track; otherwise the previous one. */
  prev() {
    if (this.elapsed > 3) {
      if (this.audio) this.audio.currentTime = 0;
      this.emit();
      return;
    }
    const index = Math.max(0, this.track - 1);
    if (this.state === 'playing') this.play(index);
    else this.cue(index);
  }

  louder() { this.setVolume(this.volume + 1); }
  quieter() { this.setVolume(this.volume - 1); }

  /** Fills `out` with band levels (0 … 1, log-spaced 60 Hz … 12 kHz) and returns the bass level; zeros when silent. */
  spectrum(out: Float32Array) {
    if (this.state !== 'playing' || !this.analyser || !this.bins) {
      out.fill(0);
      return 0;
    }
    this.analyser.getByteFrequencyData(this.bins);
    const bins = this.bins, hz = this.analyser.context.sampleRate / this.analyser.fftSize;
    const band = (lo: number, hi: number) => {
      const a = Math.max(1, Math.floor(lo / hz)), b = Math.max(a + 1, Math.ceil(hi / hz));
      let sum = 0;
      for (let i = a; i < b; i++) sum += bins[i];
      return sum / (b - a) / 255;
    };
    for (let i = 0; i < out.length; i++) out[i] = band(60 * Math.pow(200, i / out.length), 60 * Math.pow(200, (i + 1) / out.length));
    return band(40, 140);
  }

  /** The page is going away: nothing would be left to stop it with. */
  silence() {
    this.playRequest++;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    void this.context?.close().catch(() => {});
    this.audio = undefined;
    this.context = this.gain = this.analyser = undefined;
    this.state = 'stopped';
    this.emit();
  }

  /** Skipping while paused or stopped moves to the track and waits there, as a CD player does. */
  private cue(index: number) {
    this.track = index;
    if (this.audio?.getAttribute('src')) this.audio.src = album.tracks[index].src;
    this.emit();
  }

  private setVolume(step: number) {
    this.volume = Math.max(0, Math.min(VOLUME_STEPS, step));
    if (this.gain) this.gain.gain.value = GAIN(this.volume);
    else if (this.audio) this.audio.volume = GAIN(this.volume);
    this.emit();
  }

  private emit() {
    this.session();
    this.listeners.forEach((fn) => fn());
  }

  private ensureAudio() {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('ended', () => {
      if (this.track + 1 < album.tracks.length) this.play(this.track + 1);
      else {
        // After the last track the player stops on the first, as a CD player does.
        this.state = 'stopped';
        this.cue(0);
      }
    });
    audio.addEventListener('error', () => {
      if (this.audio !== audio || !audio.getAttribute('src')) return;
      this.failed = true;
      this.state = 'stopped';
      this.emit();
    });
    this.audio = audio;
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) {
        const context = new Context();
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        analyser.minDecibels = -88;
        analyser.maxDecibels = -22;
        const gain = context.createGain();
        gain.gain.value = GAIN(this.volume);
        source.connect(analyser);
        source.connect(gain).connect(context.destination);
        this.context = context;
        this.analyser = analyser;
        this.gain = gain;
        this.bins = new Uint8Array(analyser.frequencyBinCount);
      } else audio.volume = GAIN(this.volume);
    } catch {
      // Without Web Audio it still plays; only the display's spectrum stays dark.
      audio.volume = GAIN(this.volume);
    }
    const media = navigator.mediaSession;
    if (media) {
      const on = (action: MediaSessionAction, fn: () => void) => { try { media.setActionHandler(action, fn); } catch { /* not offered here */ } };
      on('play', () => this.play());
      on('pause', () => this.pause());
      on('stop', () => this.stop());
      on('previoustrack', () => this.prev());
      on('nexttrack', () => this.next());
    }
    return audio;
  }

  private session() {
    const media = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!media || !this.audio || typeof MediaMetadata === 'undefined') return;
    const track = album.tracks[this.track];
    if (media.metadata?.title !== track.title) {
      media.metadata = new MediaMetadata({ title: track.title, artist: album.artist, album: album.title, artwork: [{ src: album.cover, sizes: '1024x1024', type: 'image/webp' }] });
    }
    media.playbackState = this.state === 'playing' ? 'playing' : this.state === 'paused' ? 'paused' : 'none';
  }
}

export const albumPlayer = new AlbumPlayer();
