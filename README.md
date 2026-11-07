# Greek Café World Radio (browser add-on)

A standalone high-quality internet-radio player for Greek / Laïká / Nonstop, Deep House, Lounge, and R&B.

## What this implements
- Direct playback from original broadcaster URLs via HTML audio (no transcoding or robotic resynthesis).
- Volume, stations, categories, search, media controls.
- Optional very light (~3.5% wet) early-room reflection, **only** when the stream permits cross-origin audio processing.
- No app ads, tracking, recording, or microphone access.
- Installable PWA on compatible mobile/desktop browsers (HTTPS).
- Direct links to stations via ?station=station-id.

## Boundaries
- NOT an in-Roblox embedded webview. Roblox clients cannot load websites as audio sources in native 3D speakers.
- The audio plays on the device running this web app. Browser + Roblox can run concurrently on a PC, but do not share a spatial sound engine.
- A third-party radio station may put ads into its own audio; this app cannot remove those ads.
- Stream availability and licensing depend on broadcasters. Some streams deny cross-origin processing, in which case the original audio plays directly without room effects or real spectrum visualization.
- Github Pages serves static files only. The browser fetches each stream from its broadcaster. Nothing is rebroadcast by this repository.

This repository contains no private credentials or Roblox project source files.
