---
name: compose-track
description: Write, check, render and wire in a soundtrack track for Wurm's generated piano music (src/audio/music). Use when asked for a new music track, a change to a track, or music for a new part of the day, season or page.
---

# A soundtrack track

## The engine (read first)
| File | What it holds |
|---|---|
| `src/audio/music/score.ts` | The notation. Each bar has `c` (chord: pad and pedal; `\|` splits it), `l` (left hand), `r` (right hand), and optional `b` (music box), `e` (celesta) and `h` (harp). Tokens are `D5:2`, `G2+D3`, `r:1`, `@2.5`; a line with no `:` or `@` is spread evenly over the bar. A form is a list of passes with `lift`, `turn` and `dyn`. |
| `src/audio/music/instruments.ts` | The instruments: felt piano, music box, celesta, harp, pad, the room and the bus. Notes are made at 24 kHz, every 3 semitones. |
| `src/audio/music/conductor.ts` | Schedules the bars. The last bar of the form is held back 12%. |
| `src/audio/music/playlist.ts` | Which track plays when, by game hour and season. The sign-in page's tracks are in `playlist-sign-in.ts`. |
| `src/audio/music/bridge.ts` | The harp bridge and the equal-power crossfade between tracks. |

The reference track is `tracks/blossom.ts`, approved by the user at 52 BPM. Every melody plays at `MELODY_TOUCH` 0.3 and `MELODY_LEVEL` 0.5 by default, as the user asked.

## Rules for a track
- **Instruments:** piano covers MIDI 28–96, music box 72–100, celesta 60–96, harp 36–91.
- **Form:** sections are multiples of 4 bars, in phrases of 8, and a loop runs 3.5–5.5 minutes.
- **Harmony:** bar 1 is the tonic; the last bar is unresolved and leads back into bar 1.
- **Metre:** 4/4 is `beats: 4` and 3/4 is `beats: 3`. 6/8 is `beats: 6` with `bpm` = 3 × the dotted-quarter pulse.
- **Style:** gentle pastel fantasy. A singable melody, broken-chord left hand, sparse sparkle on the peaks, no parallel fifths or octaves between melody and bass.
- **Header comment:** key, tempo, metre, form, the entry chord and the exit chord.

## Check and render
The harness lives in the session scratchpad (`ost/render-track.mjs`), so rebuild it if a new session lacks it. It does three things:
1. **Bundles the track** with esbuild.
2. **Checks it:** structure, ranges, bars that run over, and long melody notes a semitone off a chord tone.
3. **Renders it** through the real conductor in Chromium with an `OfflineAudioContext`: a 90-second clip and the full loop plus 30 s, written as WAV, MP3 (ffmpeg) and a waveform PNG.

Send the user the MP3s. You can't hear them, so say so, and lean on the checks and the waveform.

## Wire in and ship
- Add the track to a pool in `playlist.ts`.
- Run `supabase/test/music.ts`. It covers every track, every hour of every season, and every bridge pair.
- `npm run build`, commit, push and dispatch the live run.
- Help and What's new read the schedule from `playlistSays()`, so don't write it out by hand.
