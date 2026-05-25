# Upstream canonical reference — remotion-dev/remotion

These files are a **verbatim mirror** of the official Remotion Agent Skill at:

> https://github.com/remotion-dev/remotion/tree/main/packages/skills/skills/remotion

Published by the Remotion team as the source-of-truth skill the framework recommends loading for any AI agent (Claude Code, Codex, Cursor) working in a Remotion project. Reference: https://www.remotion.dev/docs/ai/skills

**Last synced:** 2026-05-16
**License:** Remotion uses the [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) — a source-available license with free tier and Cloud-Rendering-Unit / Company-License fee for paid use. The skill markdown is documentation; redistributing it inside our own skills bundle for read-only use mirrors the same pattern shadcn upstream uses. Do not strip the upstream `name:` / `description:` frontmatter from the mirrored files.

## DO NOT EDIT files in this directory directly
Edits will be overwritten on the next upstream re-sync. To layer our integration-specific behaviour, put the override in the **sibling** reference files (`../compositions.md`, `../rendering.md`, `../integration-nextjs.md`, etc.) and cite the upstream rule it adapts.

## Contents

The upstream skill is one master `SKILL.md` (navigator) plus a flat `rules/` directory of focused domain files. We mirror it 1:1.

### Navigator
| File | Purpose |
|---|---|
| `SKILL.md` | Upstream navigator — quick-start, basic composition design, links to all rules |

### Rules — fundamentals
| File | Purpose |
|---|---|
| `rules/compositions.md` | `<Composition>`, `<Still>`, `<Folder>`, `defaultProps`, dynamic metadata |
| `rules/calculate-metadata.md` | `calculateMetadata` API — dynamic duration/dimensions/props |
| `rules/parameters.md` | Parameterize a video with a Zod schema |
| `rules/sequencing.md` | `<Sequence>` patterns — delay, trim, limit duration |
| `rules/timing.md` | `interpolate`, Bézier easing, `spring()` |
| `rules/trimming.md` | Cutting the start/end of animations |
| `rules/transitions.md` | Scene transition patterns |

### Rules — assets
| File | Purpose |
|---|---|
| `rules/images.md` | `<Img>`, sizing, dynamic paths, dimensions |
| `rules/videos.md` | `<Video>` from `@remotion/media` — trimming, volume, speed, loop, pitch |
| `rules/audio.md` | Advanced audio — `<Audio>`, trimming, volume, speed, pitch |
| `rules/sfx.md` | Sound effects |
| `rules/voiceover.md` | AI voiceover via ElevenLabs TTS |
| `rules/gifs.md` | GIFs synchronized with the timeline |
| `rules/lottie.md` | Lottie animations |
| `rules/transparent-videos.md` | Rendering with alpha channel |
| `rules/light-leaks.md` | `@remotion/light-leaks` overlay effects |
| `rules/google-fonts.md` | Recommended font loader |
| `rules/local-fonts.md` | Local font loading |

### Rules — capture / measurement / FFmpeg
| File | Purpose |
|---|---|
| `rules/ffmpeg.md` | When to drop down to FFmpeg |
| `rules/get-audio-duration.md` | Audio duration via Mediabunny |
| `rules/get-video-dimensions.md` | Video width/height via Mediabunny |
| `rules/get-video-duration.md` | Video duration via Mediabunny |
| `rules/silence-detection.md` | Detecting silent segments |
| `rules/measuring-dom-nodes.md` | Measuring DOM element dimensions |
| `rules/measuring-text.md` | Text dimensions, fitting, overflow checks |
| `rules/html-in-canvas.md` | `<HtmlInCanvas>` — HTML → canvas for WebGL effects |

### Rules — captions
| File | Purpose |
|---|---|
| `rules/subtitles.md` | Entry rule — picks the right caption strategy |
| `rules/display-captions.md` | Rendering captions in the timeline |
| `rules/import-srt-captions.md` | Loading SRT files |
| `rules/transcribe-captions.md` | Generating captions via transcription |

### Rules — text / 3D / maps / styling
| File | Purpose |
|---|---|
| `rules/text-animations.md` | Typography animation patterns |
| `rules/3d.md` | Three.js + React Three Fiber inside Remotion |
| `rules/maplibre.md` | MapLibre — animated routes, flyovers, static maps |
| `rules/tailwind.md` | TailwindCSS inside a Remotion project |

### Assets (used by rules)
| File | Used by |
|---|---|
| `rules/assets/text-animations-typewriter.tsx` | `rules/text-animations.md` |
| `rules/assets/text-animations-word-highlight.tsx` | `rules/text-animations.md` |
| `rules/assets/charts-bar-chart.tsx` | (referenced from charting examples) |

## Intentionally skipped on import
- `package.json`, `tsconfig.json`, `src/` (Root.tsx, index.ts) — upstream package build infra, not informational for an agent.
- `README.md` — upstream package README (one-line "internal package"), no signal.

## How to re-sync

```bash
cd /tmp && rm -rf remotion-skills-repo
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/remotion-dev/remotion.git remotion-skills-repo
cd remotion-skills-repo
git sparse-checkout set packages/skills

# Mirror SKILL.md + rules/ + rules/assets/ into our upstream directory.
# Excludes upstream package infra (src/, package.json, tsconfig.json, README.md).
rsync -a --delete \
  --include='SKILL.md' \
  --include='rules/' --include='rules/**' \
  --exclude='*' \
  /tmp/remotion-skills-repo/packages/skills/skills/remotion/ \
  /home/ubuntu/.claude/skills/remotion/references/upstream/

# Update the "Last synced" date at the top of this file.
```

## Note on upstream `SKILL.md`
The mirrored `references/upstream/SKILL.md` is the **Remotion team's** skill navigator. It is NOT our skill's entry point — our entry point is `/home/ubuntu/.claude/skills/remotion/SKILL.md` (one level up from `references/`). When the Claude Code harness loads the `remotion` skill it loads our SKILL.md; the upstream one is reference material only.
