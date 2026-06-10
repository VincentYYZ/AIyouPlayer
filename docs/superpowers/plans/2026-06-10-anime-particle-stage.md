# Anime Particle Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AIyouPlayer visibly read as a dark cyber-idol anime music stage and migrate ParticleCloud's shader particle effect into the visualizer.

**Architecture:** Keep the Next.js App Router structure. Replace the React Three Fiber point cloud with an imperative client-side Three.js renderer adapted from `D:\App-project\ParticleCloud\src\main.ts`, wrapped by the existing `ParticleCloudStage` component so current player state still drives the visualizer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Three.js 0.184.

---

## File Map

- `app/globals.css`: cyber-idol theme tokens, neon backgrounds, scanlines, range styling.
- `app/components/topbar/TopBar.tsx`: stronger neon logo and subtitle.
- `app/components/player/PlayerBar.tsx`: concert-console styling for controls, progress, library popup, search.
- `app/components/visualizer/ParticleCloudStage.tsx`: stage shell, metadata, import button, agent panel layering.
- `app/components/visualizer/particleCloudRenderer.ts`: new imperative Three.js renderer adapted from ParticleCloud source.
- `app/components/visualizer/particleCloudShaders.ts`: new shader strings copied/adapted from ParticleCloud.
- `docs/superpowers/plans/2026-06-10-anime-particle-stage.md`: this implementation plan.

## Tasks

### Task 1: Make the visual direction unmistakable

- [ ] Update `app/globals.css` tokens from Aurora purple glass to black, hot pink, cyan, and violet neon.
- [ ] Add scanline/noise background utilities and cyber console shadows.
- [ ] Update `TopBar.tsx` logo to neon cyber-idol branding.
- [ ] Update `PlayerBar.tsx` surfaces and progress controls to concert-console styling.

### Task 2: Port ParticleCloud core

- [ ] Create `particleCloudShaders.ts` containing ParticleCloud shader strings, with unused dat.gui code omitted.
- [ ] Create `particleCloudRenderer.ts` with a `CyberParticleCloudRenderer` class.
- [ ] Copy/adapt image sampling, subject masking, edge strength, halo field, and interaction sphere logic from `D:\App-project\ParticleCloud\src\main.ts`.
- [ ] Expose methods: `mount`, `dispose`, `setImageSource`, `setPlaying`, `resize`.

### Task 3: Replace the current visualizer implementation

- [ ] Modify `ParticleCloudStage.tsx` to use the new renderer in a `div` ref.
- [ ] Keep cover image, manual upload, fallback source, danmaku overlay, stage agent panel, and stage meters.
- [ ] Tune default ParticleCloud parameters for cyber-idol style and acceptable performance.

### Task 4: Verify

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Verify `http://localhost:3001` returns 200.
- [ ] Visually inspect desktop and mobile widths for nonblank canvas and stronger cyber-idol styling.
