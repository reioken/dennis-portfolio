import { aboutContent } from './about-content';

/**
 * memoryrot, "a lifetime, briefly": the album the hall's CD player plays (src/components/hall/cdPlayer.ts). Titles and
 * lengths as released on Spotify; the files are the Mixea-style masters, which are what Spotify streams, encoded as
 * AAC into public/media/music/a-lifetime-briefly/ together with the cover (docs/cd-player.md). Dennis asked for the
 * album to play on the site on 2026-10-06 ("pick the songs and play them right there"). A track file that does not
 * load hands the player over to the album on Spotify.
 */
export const album = {
  ...aboutContent.music,
  selfHosted: true,
  cover: '/media/music/a-lifetime-briefly/cover.webp',
  tracks: [
    { title: 'before i knew', seconds: 214.695, src: '/media/music/a-lifetime-briefly/01-before-i-knew.m4a' },
    { title: 'let this last', seconds: 199.86, src: '/media/music/a-lifetime-briefly/02-let-this-last.m4a' },
    { title: 'i remember it differently', seconds: 194.408, src: '/media/music/a-lifetime-briefly/03-i-remember-it-differently.m4a' },
    { title: 'all at once', seconds: 246, src: '/media/music/a-lifetime-briefly/04-all-at-once.m4a' },
    { title: "what i couldn't keep", seconds: 274.666, src: '/media/music/a-lifetime-briefly/05-what-i-couldn-t-keep.m4a' },
    { title: 'still, it happened', seconds: 237.09, src: '/media/music/a-lifetime-briefly/06-still-it-happened.m4a' },
  ],
};

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
