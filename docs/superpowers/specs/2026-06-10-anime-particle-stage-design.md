# AIyouPlayer Dark Anime Particle Stage Design

## Goal

Restyle AIyouPlayer into a dark cyber-idol anime stage and migrate the ParticleCloud particle system from `D:\App-project\ParticleCloud` into `D:\App-project\AIyouPlayer`.

The selected visual direction is **A. Cyber Idol Stage**: black stage, hot-pink and cyan neon, luminous music UI, and an idol-concert control surface. The app should feel like a playable anime music stage rather than a generic glassmorphism dashboard.

## Scope

- Replace the current simple React Three Fiber particle cloud with a ParticleCloud-derived shader particle stage.
- Preserve AIyouPlayer behavior:
  - current track cover becomes the particle source when available;
  - fallback particle source works when no track/cover is selected;
  - manual image import remains available;
  - playback state increases motion intensity;
  - danmaku overlay and agent panel still layer above the stage.
- Restyle the main shell, global theme, top brand, stage chrome, bottom player, library popup, and common glass controls toward the cyber-idol aesthetic.
- Keep the work inside the existing Next.js app; do not embed the ParticleCloud Vite app or dat.gui.

## Particle Architecture

Create a reusable client-side particle stage module adapted from `ParticleCloud/src/main.ts`.

The migration should preserve the important ParticleCloud effects:

- shader-based image particles with custom vertex and fragment shaders;
- image sampling with subject masking, edge density, curved surface depth, scatter, and color attributes;
- upper escape/halo particle field driven by source-image edge weights;
- transparent interactive gravity sphere following pointer movement;
- orbit controls or equivalent inspection controls without blocking the rest of the UI;
- runtime uniform updates for time, particle size, flow, escape motion, sphere position, and playback dance strength.

Adaptations for AIyouPlayer:

- remove dat.gui and expose fixed cyber-idol tuned defaults in code;
- lower or scale `ESCAPE_COUNT` if needed for app performance, especially on mobile;
- load images from the current track cover, uploaded file, or generated fallback art/text;
- clean up renderer, geometries, materials, event listeners, and animation frames on unmount;
- avoid direct global `window.initParticles` APIs.

## UI Design

Use a dark anime stage system:

- Base: near-black blue-black background with subtle neon grain and scanline texture.
- Accents: hot pink, cyan, violet highlights, and small white specular glints.
- Typography: keep system-compatible Chinese rendering, but use tighter uppercase labels and high-contrast display styling for brand/stage metadata.
- Shapes: sharper panels and 8-18px radii instead of very soft glass blobs; no nested card-on-card layout.
- Motion: pulse neon rails and stage meters lightly; particle animation carries the main motion.

Component treatment:

- `globals.css`: retune design tokens from Aurora purple glass to cyber-idol neon.
- `TopBar`: stronger anime-stage logo lockup with pink/cyan glow and compact subtitle.
- `ParticleCloudStage`: becomes the full visual stage wrapper around the migrated particle renderer; stage text should be readable and not obscure the particle subject.
- `PlayerBar`: keep existing controls and workflows, but restyle as a bottom concert console with neon progress, tighter panels, and dark translucent surfaces.
- `StageAgentPanel`, library popup, and common controls: align borders, shadows, labels, and active states with the new palette.

## Data Flow

`ParticleCloudStage` continues to read from the existing player context:

- `current.cover` chooses the active image source.
- `current.title` and `current.author` drive stage metadata.
- `playing` controls dance intensity and stage-meter behavior.
- `currentTime` may be used as a rhythm input if needed.

Manual image import overrides the current cover until no cover is present or the user imports another image.

## Error Handling

- If cover loading fails, fall back to a generated cyber-idol text/image particle source.
- If WebGL initialization fails, show a dark fallback stage with metadata and a nonblocking message.
- If image sampling creates too few particles, fall back to generated source content.
- Keep console noise low; do not leave ParticleCloud debug logging in production components.

## Testing And Verification

Automated checks:

- Run lint/build after implementation.
- Add focused tests only where behavior can be isolated cheaply, such as pure image/sampling helpers if extracted.

Manual/browser verification:

- Verify the app loads at the local dev URL.
- Verify no blank canvas on desktop and mobile viewport widths.
- Verify current-cover, fallback, and manual upload paths render particles.
- Verify pointer interaction moves the gravity sphere and affects particles.
- Verify bottom player and top/stage text do not overlap or hide core controls.
- Verify performance remains usable with the migrated escape particles.

## Out Of Scope

- Rewriting player state, search, download, or chat behavior.
- Adding a new settings panel for particle controls.
- Keeping dat.gui in AIyouPlayer.
- Deploying the app.
