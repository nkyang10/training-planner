# UI revamp: a tablet app shell for a training platform (2026-11-05)

The product outgrew the "mini tool" look. This note records the design system, the generated art, and the rules a future
page follows so the app stays one product rather than a pile of forms.

## Style

**Bright, energetic, summer, on fire, powerful.** Warm ember/solar/coral on cream, deep charcoal ink, a bold display
face, generous spacing, 20 px radii, warm shadows. No dark theme in this pass; no gradients as decoration without a job.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--ember` | `#FF5A1F` | primary action, today ring, eyebrow |
| `--solar` | `#FFB020` | gradient middle, highlights |
| `--coral` | `#FF4D6D` | gradient end, energy accents |
| `--ink` | `#1B120C` | headings, body |
| `--paper` | `#FFF8F0` | page background |
| `--surface` | `#FFFFFF` | cards, sidebar |
| `--wash` | `#FFF1E4` | hover, quiet panels |
| `--line` | `#F0DCCB` | hairlines |
| `--heat` | `linear-gradient(135deg,#FF5A1F,#FFB020 55%,#FF4D6D)` | hero, primary buttons, active nav |
| `--radius` / `--shadow` | `20px` / `0 18px 40px -24px rgba(90,40,10,.45)` | cards |

Type: **Bricolage Grotesque** for display (page titles, stat values, card titles), **Inter** for body; both loaded from
Google Fonts with system fallbacks, so an offline device still renders.

## Shell

```
+----------------+---------------------------------------------+
| sidebar 268px  | topbar (title + Today + Month)              |
| brand          +---------------------------------------------+
| Train  Week    | main: page-head -> hero -> stats -> cards   |
|        Month   |                                             |
|        Season  |                                             |
| Log    Today   |                                             |
|        Pain    |                                             |
| Plan   Orient. |                                             |
|        Console |                                             |
| Account Conn.  |                                             |
+----------------+---------------------------------------------+
```

- **≤900 px**: the sidebar hides, the same destinations fold into a fixed bottom bar (`.tabs`, 44 px targets, safe-area
  padding), and `.main` gets bottom padding so content is never hidden.
- **≤640 px**: week grid becomes two columns; the month grid keeps seven columns with compact cells.
- The sign-in page uses `main-auth`: brand + card, no sidebar.

## Generated art (ComfyUI, Flux 2)

| Asset | Prompt intent | Use |
|---|---|---|
| `hero-week.png` | abstract fiery summer gradient, diagonal light streaks, premium sports key visual | week hero |
| `hero-season.png` | deep charcoal + burnt ember heat streaks | season hero |
| `surface-texture.png` | cream paper with tangerine light leaks | optional surface wash |

Prompts exclude text, logos and people; assets are decorative (`aria-hidden` context via CSS background) and never carry
meaning that the copy does not also carry. Served from `/static/assets/*.png` with an image content type and a
path-traversal guard.

## Page rules

1. Every signed-in page starts with `.page-head`: eyebrow (uppercase, ember), `.page-title` (display, clamp), `.page-sub`
   (one sentence, max 68ch).
2. A page may add one `.hero` with the generated art; the copy inside must be a fact the page already knows.
3. Stats are `.stat-grid` tiles, never prose: value first, label second.
4. Cards are for content, not layout: no card inside a card.
5. The primary action is a `.btn-primary` and there is at most one per page.
6. Copy comes from the catalogue; the design never invents a claim the engine did not produce.
