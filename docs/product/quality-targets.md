---
status: draft
updated: 2026-10-09
---

# Quality Targets (Non-Functional Requirements)

Measurable goals. Specs and tests use these numbers. All are **proposals**; the owner adjusts them.

## Speed
| What | Target |
|---|---|
| Click "Join" → in the meeting, seeing/hearing others | under **3 seconds** (good network) |
| Audio delay between two people in the same region | under **250 ms** |
| Live caption appears after someone speaks | under **2 seconds** |
| Minutes ready after a 1-hour meeting ends | under **2 minutes** |
| Ask AI answer starts appearing | under **3 seconds**; complete under **10 seconds** |
| Desktop app start-up | under **3 seconds** |

## Scale & reliability
| What | Target |
|---|---|
| Participants per meeting | **100** (with video), smooth on a normal laptop |
| Uptime | **99.9%** per month (≈ 43 minutes of downtime max) |
| Call survives a short network drop | reconnects automatically within **10 seconds** |
| Desktop memory use in a 25-person video call | under **600 MB** |

## Transcription & AI quality
| What | Target |
|---|---|
| Transcription word error rate, clear English audio | under **10%** (measured on our test recordings) |
| Correct speaker name per line | **99%+** (each mic is transcribed separately) |
| Ask AI answers that cite a correct source | **95%+** on our evaluation set |
| AI answers "I couldn't find that" instead of inventing | required: no made-up answers |

## Supported platforms
| Platform | Versions |
|---|---|
| macOS | 12 (Monterey) and newer, Intel + Apple Silicon |
| Windows | 10 and 11 |
| Browsers | Latest 2 versions of Chrome, Edge, Firefox, Safari |
| iOS / Android (later) | iOS 16+ / Android 10+ |

## Accessibility & languages
- **WCAG 2.2 AA**: full keyboard use, screen reader support, good contrast, captions.
- UI language: English at launch; built so more languages (including right-to-left like Urdu/Arabic) can be added without code changes.
