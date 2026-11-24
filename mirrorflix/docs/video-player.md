# Video player

Preview locally with Node 24: `npm ci`, then `npm run dev`. Open the Anime Series
card, then Play or an episode row. Back returns to the show modal. The player is
an in-app full-screen native dialog; the fullscreen control optionally enters
browser fullscreen.

## Sources and demo

Database anime records can lack direct episode streams. In that case the modal uses
the local Streambert service to resolve episodes and HLS playback on demand. The static demo's explicit `demoVideo`
configuration uses the Big Buck Bunny clip at
https://www.w3schools.com/html/mov_bbb.mp4 (Blender Foundation, CC BY 3.0).
Film and attribution: https://peach.blender.org/ and
https://peach.blender.org/about/ . License: https://creativecommons.org/licenses/by/3.0/ .
The external clip is unmodified, labelled as a demo in the player, and is not an
anime episode. Its availability is controlled by the external host. No media
files are committed or included in the Vite build.

For direct playback add `videoUrl` to each episode; this always takes priority over
Streambert resolution and the demo. Anime records without a direct source use the
local Streambert service: opening the modal retrieves numbered episodes, and a
number resolves that episode's proxied HLS source. Remove `movie.demoVideo` to
disable demo fallback. Optional episode fields:

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
configuration. Use browser-compatible MP4, typically H.264/AAC, for progressive
video. HLS `.m3u8` playback uses native browser support or lazy-loaded HLS.js.
Streambert playlists, encryption keys, subtitles, and segments go through its
same-origin tokenized proxy, which forwards byte ranges. There is no DRM or
custom quality-selection UI. Do not embed credentials
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

Playback errors distinguish network/proxy failures, expired or missing sources,
and unsupported media. Sanitized HLS and media diagnostics are written to the
browser console; proxy warnings omit signed query strings. Try again closes the
failed player and resolves a fresh provider stream rather than reusing the old
signed URL. Playlist detection accepts `.m3u8` URLs with query parameters so all
variant, key, and segment URLs remain on the same-origin playback proxy.

## Deployment

Anime playback requires the Node Streambert service and same-origin API forwarding; `npm run dev` starts both locally. Production deployment must provision that service separately. FastAPI and the database schema are unchanged.

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
