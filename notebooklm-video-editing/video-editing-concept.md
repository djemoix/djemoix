# Video Editing Concept Guide — NotebookLM Source Document

> **Purpose:** This document is structured as a NotebookLM source. Upload it to NotebookLM to generate audio overviews, Q&A sessions, study guides, and briefing docs on video editing fundamentals.

---

## 1. What Is Video Editing?

Video editing is the process of manipulating and rearranging video shots to create a final film, video clip, or broadcast. It involves cutting footage, adding transitions, applying effects, adjusting color, syncing audio, and exporting the finished product.

Video editing bridges raw footage and a polished story. The editor's job is not just technical — it's narrative. Every cut, every transition, and every pause serves the story.

---

## 2. Core Concepts

### 2.1 Timeline

The **timeline** is the central workspace in any video editor. It is a linear representation of the project arranged along a time axis.

- **Tracks:** Horizontal lanes on the timeline. Video tracks stack on top of each other; the highest track renders on top. Audio tracks play simultaneously.
- **Playhead:** The vertical line that indicates the current playback position.
- **In/Out Points:** Markers that define the start and end of a clip before placing it on the timeline.
- **CTI (Current Time Indicator):** Same as the playhead in tools like Adobe Premiere Pro.

### 2.2 Cuts and Transitions

A **cut** is the most fundamental edit — the instantaneous switch from one shot to another.

| Type | Description |
|---|---|
| Hard Cut | Abrupt, immediate change between two clips |
| Jump Cut | Cut between two shots of the same subject at slightly different angles/times |
| Match Cut | Cut that links two clips by visual similarity or action continuity |
| L-Cut | Audio from the next clip plays before the video transitions |
| J-Cut | Audio from the next clip starts before the current clip ends (reverse L-cut) |
| Cutaway | Cut to a secondary shot, then back to the original |

**Transitions** are animated effects between clips:
- Dissolve / Cross Dissolve
- Wipe
- Fade to Black / Fade from Black
- Zoom Transition
- Glitch Transition

> **Rule of thumb:** Overusing transitions is a beginner mistake. Hard cuts are invisible to the viewer when timed correctly.

### 2.3 B-Roll

**B-roll** is supplementary footage intercut with the main (A-roll) footage. It:
- Covers jump cuts
- Adds context and visual variety
- Supports the narration or interview audio

### 2.4 Pacing and Rhythm

**Pacing** is the speed at which the story moves. It is controlled by:
- **Clip length** — longer clips = slower pace
- **Number of cuts** — more cuts = faster, more energetic feel
- **Music tempo** — cutting on the beat drives rhythm

Types of pacing:
- **Fast-paced editing** (action videos, trailers, social media reels): many short cuts, dynamic transitions
- **Slow pacing** (documentaries, emotional scenes): longer clips, lingering shots

---

## 3. Video Editing Workflow

A professional video editing workflow follows these stages:

### Stage 1 — Ingestion
- Import raw footage, audio, and assets into the project
- Organize media in bins/folders by scene, date, or type
- Create proxy files for heavy 4K/6K footage to speed up editing

### Stage 2 — Assembly Edit (Rough Cut)
- Place all selected clips in rough chronological order
- Do not worry about precision — focus on overall structure
- Cut obvious mistakes and unusable takes

### Stage 3 — Rough Cut
- Tighten the assembly edit
- Remove dead air and filler words (for talking-head content)
- Establish the pacing and narrative flow

### Stage 4 — Fine Cut
- Frame-accurate trimming of every cut
- Apply B-roll to cover transitions
- Sync all audio precisely

### Stage 5 — Color Correction
- Balance exposure, white balance, and shadows/highlights
- Goal: make footage look natural and consistent across all clips

### Stage 6 — Color Grading
- Apply a creative "look" or LUT (Look-Up Table)
- Establish a mood: warm/cold, desaturated, high contrast, cinematic, etc.
- Common grading styles: Orange & Teal, Matte Black, Film Emulation

### Stage 7 — Audio Mix
- Normalize dialog audio to around -12 dB to -6 dB
- Add background music, reduce music under dialog
- Add sound effects (SFX) where needed
- Apply EQ, compression, and noise reduction

### Stage 8 — Graphics and Titles
- Add lower thirds, name cards, titles, and end screens
- Animate text if needed
- Apply brand overlays or watermarks

### Stage 9 — Export / Render
- Choose the right codec and container for the delivery platform

---

## 4. Key Technical Concepts

### 4.1 Resolution and Aspect Ratio

| Format | Resolution | Common Use |
|---|---|---|
| 1080p (Full HD) | 1920 × 1080 | YouTube, social media |
| 4K (UHD) | 3840 × 2160 | High-end production |
| 720p (HD) | 1280 × 720 | Web / streaming |
| Vertical 9:16 | 1080 × 1920 | Reels, Shorts, TikTok |
| Square 1:1 | 1080 × 1080 | Instagram feed |

### 4.2 Frame Rate (FPS)

- **24 fps** — Cinematic, film look
- **25 fps** — PAL standard (Europe/Asia broadcast)
- **30 fps** — Standard video, YouTube, news
- **60 fps** — Smooth motion, gaming content, sports
- **120 fps** — Slow-motion footage (shot at 120, played at 30 = 4× slow-mo)

### 4.3 Codecs and Containers

| Container | Common Codecs | Use Case |
|---|---|---|
| .mp4 | H.264, H.265 | Universal delivery |
| .mov | ProRes, H.264 | Apple ecosystem, editing |
| .mkv | H.264, H.265 | High-quality archival |
| .webm | VP9, AV1 | Web streaming |

**H.264** = most compatible, good quality-to-file-size ratio.
**H.265 (HEVC)** = 50% smaller file at same quality, but heavier to decode.
**ProRes** = lossless/near-lossless, used in professional editing workflows.

### 4.4 Bitrate

Bitrate controls the amount of data used per second of video:
- **Higher bitrate** = better quality, larger file
- **Lower bitrate** = smaller file, more compression artifacts
- YouTube recommends: 8 Mbps for 1080p60, 35–45 Mbps for 4K60

### 4.5 Color Spaces and Bit Depth

- **sRGB / Rec. 709** — Standard color space for web/SDR displays
- **DCI-P3** — Wider gamut used in cinema
- **Rec. 2020** — HDR, ultra-wide gamut
- **8-bit** — 16.7 million colors (standard)
- **10-bit** — 1.07 billion colors, needed for HDR and smooth gradients
- **LOG profiles (S-Log, C-Log, V-Log)** — Flat, low-contrast profiles that preserve more dynamic range for grading

---

## 5. Audio in Video Editing

### 5.1 Audio Levels
- **Dialog:** -12 dB to -6 dB (average)
- **Music (behind dialog):** -20 dB to -18 dB
- **Music (no dialog):** -12 dB to -6 dB
- **Sound Effects:** Varies by intent — match perceived loudness
- **Master output:** Do not clip above 0 dB (true peak -1 dBTP for streaming)

### 5.2 Common Audio Issues and Fixes

| Problem | Fix |
|---|---|
| Background hum/noise | Noise reduction plugin (e.g., iZotope RX, Audacity's Noise Reduction) |
| Echo/reverb | EQ to cut low-mids, gate plugin |
| Clipping (audio crunch) | Reduce gain, use a limiter |
| Muffled voice | EQ boost at 3–5 kHz, high-pass filter below 80 Hz |
| Music overpowering voice | Sidechain compression or manual automation |

### 5.3 Music Licensing

- **Royalty-Free Music:** One-time license fee, use anywhere (Artlist, Epidemic Sound, Musicbed)
- **Creative Commons:** Free, but attribution may be required (check license type: CC0, CC-BY, CC-BY-SA)
- **Copyright-Free (Public Domain):** Works whose copyright has expired
- **Sync License:** Required for using commercial music in video

---

## 6. Popular Video Editing Software

### Professional / Industry Standard
| Software | Platform | Best For |
|---|---|---|
| Adobe Premiere Pro | Win / Mac | All-purpose professional editing |
| DaVinci Resolve | Win / Mac / Linux | Color grading, professional editing (free tier available) |
| Final Cut Pro X | Mac only | Fast editing, Apple ecosystem |
| Avid Media Composer | Win / Mac | Broadcast and film industry |

### Intermediate / Semi-Pro
| Software | Platform | Best For |
|---|---|---|
| CapCut | Win / Mac / Mobile | Social media content |
| Filmora | Win / Mac | Beginners to intermediate |
| Vegas Pro | Win | Long-time Windows editor |

### Free / Open Source
| Software | Platform |
|---|---|
| DaVinci Resolve (Free) | Win / Mac / Linux |
| Kdenlive | Linux / Win / Mac |
| OpenShot | Linux / Win / Mac |
| Shotcut | Linux / Win / Mac |

---

## 7. Storytelling Principles for Editors

### The 5 C's of Cinematography (applies to editing too)
1. **Camera angles** — Use a variety of angles to keep visual interest
2. **Continuity** — Maintain consistent screen direction and eyeline
3. **Cutting** — Cut on action, cut on reaction
4. **Close-ups** — Use close-ups for emotional impact
5. **Composition** — Rule of thirds, headroom, leading lines

### The 6 Criteria for a Good Edit (Walter Murch)
In order of importance:
1. Emotion — Does the edit preserve the emotion?
2. Story — Does it advance the story?
3. Rhythm — Is it rhythmically interesting/satisfying?
4. Eye trace — Where is the viewer's eye?
5. 2D plane of screen — Is the axis of action respected?
6. 3D space — Does the geography make sense?

### The 180-Degree Rule
In a scene with two people, the camera should always stay on one side of an imaginary axis between them. Crossing this line causes a disorienting "screen direction reversal."

---

## 8. Video Editing for Social Media

### YouTube
- Optimal length: 8–15 minutes for broad topics, longer for tutorials
- Hook within first 30 seconds
- Chapters via timestamps improve retention
- Thumbnail design is as important as the video itself

### Instagram Reels / TikTok / YouTube Shorts
- Vertical format (9:16), 1080×1920
- Maximum length: 60–90 seconds for Reels, 3 minutes for TikTok, 60 seconds for Shorts
- Fast pacing, text overlays, trending audio
- Open-loop hook: create curiosity in the first 2 seconds

### LinkedIn Video
- Square (1:1) or landscape (16:9)
- 1–3 minutes optimal
- Add captions (85% watched without sound)

---

## 9. Color Grading Basics

### Primary Color Correction Tools
- **Lift (Shadows):** Adjust the darkest areas
- **Gamma (Midtones):** Adjust mid-brightness areas
- **Gain (Highlights):** Adjust the brightest areas
- **Saturation:** Intensity of colors
- **Hue:** Shift all colors around the color wheel

### Secondary Color Correction
- Isolate and adjust specific colors (e.g., make the sky more blue without affecting skin tones)
- HSL Qualifier (DaVinci Resolve) or Hue/Saturation Curves

### LUTs (Look-Up Tables)
LUTs are preset color transformations:
- **Technical LUT:** Converts LOG footage to a viewable color space (e.g., S-Log3 to Rec.709)
- **Creative LUT:** Applies a stylistic look on top of corrected footage

Popular free LUT packs: Film Riot, Ground Control, Iwltbap

---

## 10. Export Settings Reference

### YouTube 1080p (Recommended)
- Container: .mp4
- Codec: H.264
- Resolution: 1920×1080
- Frame rate: Match source (24/25/30/60)
- Bitrate: 8–12 Mbps (VBR, 2-pass)
- Audio: AAC, 320 kbps, 48 kHz

### YouTube 4K
- Container: .mp4
- Codec: H.265 or H.264
- Resolution: 3840×2160
- Bitrate: 35–68 Mbps

### Instagram Reels / TikTok
- Container: .mp4
- Codec: H.264
- Resolution: 1080×1920
- Frame rate: 30 fps
- Bitrate: 10–20 Mbps
- Audio: AAC, 128 kbps, 44.1 kHz

---

## 11. Keyboard Shortcuts (Adobe Premiere Pro)

| Shortcut | Action |
|---|---|
| `C` | Razor/Cut tool |
| `V` | Selection tool |
| `Space` | Play/Pause |
| `I` / `O` | Mark In / Mark Out |
| `Ctrl+Z` | Undo |
| `Ctrl+K` | Razor cut at playhead |
| `Q` | Ripple trim (close gap to left) |
| `W` | Ripple trim (close gap to right) |
| `Shift+Delete` | Ripple delete |
| `Ctrl+M` | Export (Media Encoder) |
| `,` / `.` | Insert / Overwrite clip |
| `\` | Fit timeline to window |

---

## 12. Common Beginner Mistakes

1. **Not organizing footage before editing** — Wastes time, causes lost files
2. **Using too many transitions** — Distracts from the content
3. **Ignoring audio** — Viewers tolerate bad video, not bad audio
4. **Not color-correcting first before grading** — Leads to inconsistent looks
5. **Exporting with wrong settings** — Pixelated or washed-out result
6. **Not backing up the project** — Always have a backup on an external drive
7. **Cutting on random frames** — Cut on action or motion for invisible cuts
8. **Music too loud** — Dialog must be intelligible at all times

---

## 13. Glossary

| Term | Definition |
|---|---|
| A-Roll | Primary footage (main interview, presentation, etc.) |
| B-Roll | Supplementary/cutaway footage |
| Bitrate | Amount of data used per second of video |
| Codec | Algorithm used to compress/decompress video |
| Color Grading | Creative color styling of a video |
| Crop Factor | Ratio of sensor size vs full-frame |
| FPS | Frames Per Second |
| Jump Cut | Edit between two similar shots creating a visual "jump" |
| Keyframe | A point in time where an animation or property value is set |
| LUT | Look-Up Table — a color preset |
| NLE | Non-Linear Editor (Premiere, Resolve, FCPX) |
| Proxy | A low-res copy of footage used for faster editing |
| Render | The process of processing and exporting the final video |
| Timeline | The main editing workspace in an NLE |
| Transcoding | Converting media from one format/codec to another |

---

*This document is optimized for upload to Google NotebookLM. After uploading, you can ask NotebookLM to generate a study guide, an audio overview (podcast), Q&A pairs, or a briefing document based on this content.*
