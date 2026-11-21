# Video player

Preview locally with Node 24: `npm ci`, then `npm run dev`. Open the Anime Series
card, then Play or an episode row. Back returns to the show modal. The player is
an in-app full-screen native dialog; the fullscreen control optionally enters
browser fullscreen.

## Sources and demo

The current catalog has no actual episode streams. Its explicit `demoVideo`
configuration uses the Big Buck Bunny clip at
https://www.w3schools.com/html/mov_bbb.mp4 (Blender Foundation, CC BY 3.0).
Film and attribution: https://peach.blender.org/ and
https://peach.blender.org/about/ . License: https://creativecommons.org/licenses/by/3.0/ .
The external clip is unmodified, labelled as a demo in the player, and is not an
anime episode. Its availability is controlled by the external host. No media
files are committed or included in the Vite build.

For real playback add `videoUrl` to each episode; this always takes priority over
the demo. Remove `movie.demoVideo` to disable fallback. Without either source the
modal displays an availability message. Optional episode fields:

```js
{
  id: 'episode-1',
  title: 'Episode one',
  videoUrl: 'YOUR_HTTPS_MP4_URL',
  thumbnail: 'YOUR_POSTER_URL',
  subtitles: [
    { src: 'YOUR_WEBVTT_URL', language: 'en', label: 'English', default: true }
  ]
}
```

Prefer same-origin captions; cross-origin caption tracks need compatible CORS
configuration. Use browser-compatible MP4, typically H.264/AAC. There is no HLS,
DRM, quality switching, or invented backend integration. Do not embed credentials
in browser code. Private media needs a separately implemented authorized delivery
mechanism. The existing `onPlay` callback continues to delegate playback to the
caller when provided; `showVideoPlayer={false}` disables built-in playback.

## Controls

Play/pause, seek, ±10 seconds, mute/volume, captions when provided, fullscreen,
retry, replay and back. Space toggles playback, left/right seek ten seconds,
up/down adjust volume, M toggles mute, and F toggles browser fullscreen. Shortcuts
only apply inside the player and do not override form/button interactions.
Escape exits browser fullscreen first; otherwise closes the player. Browsers may
consume the first Escape themselves. Focus returns to the opening control.
Playback pauses and the source is released on unmount.

Controls hide after three seconds of playback inactivity and reappear on pointer,
touch or keyboard interaction. Focused controls remain visible. Autoplay is
attempted with audio; when blocked, a user-operated Play button remains available.
Like/My List persistence and progress persistence are outside this change.

## Deployment

This feature does not change workflows, server configuration, database or backend.
Review the PR before merging. The existing main-branch deployment has a separate
SSH connectivity timeout; this player does not resolve it.

## Validation performed

Node 24.22.1: npm ci and production build pass. No lint/test scripts are currently
defined. Vite reports the existing esbuild/oxc configuration warning.

Chromium browser checks pass for opening from the modal, media decoding,
play/pause, seeking, volume/mute, fullscreen, Escape, playback stopping on close,
focus restoration, episode selection, network error/retry UI, and mobile width.
Additional checks cover simulated autoplay rejection/recovery, control auto-hide
and reveal, buffering UI, ended/replay, fullscreen Escape keeping the player open,
and not hijacking arrow keys in range controls.

The public sample returned HTTP 200 and downloaded successfully with curl. Direct
browser access in this environment failed with a media format/network error, so
browser playback tests served the downloaded sample through Playwright routing
with byte-range support. State tests also used a generated 30-second local MP4.
These media fixtures are temporary and not part of the repository. External host
playback on the user's network, production streams, and Safari/iOS remain unverified.
