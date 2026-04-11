# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:4321
npm run build    # Production build
npm run preview  # Serve production build locally
```

No lint or test scripts are configured.

The dev server requires a `.env` file with `ANTHROPIC_API_KEY` at the project root. When working in a git worktree, symlink it: `ln -s ../../.env .env`.

## Architecture

**FDL Crossword Generator** is an Astro v6 app (SSR via `@astrojs/netlify`) that generates food-themed crossword puzzles from web articles.

### Data flow

```
Admin UI (index.astro + admin.js)
  → POST /api/scrape   → src/lib/scraper.js      (cheerio HTML → plain text)
  → POST /api/extract  → src/lib/extractor.js     (Claude Haiku API → word list)
  → crossword-engine.js                            (pure JS placement algorithm)
  → localStorage['fdl_puzzle']
  → Player (/player/)
```

### Key files

| File | Role |
|------|------|
| `src/pages/index.astro` | Admin UI shell (HTML + style imports) |
| `src/scripts/admin.js` | All admin interactivity — `state.words[]`, `state.urls[]`, scrape/extract flow, word table rendering |
| `src/lib/scraper.js` | Fetches a URL, strips noise tags with cheerio, returns `{ title, text }` (max 5000 chars) |
| `src/lib/extractor.js` | Calls Claude Haiku with a food-crossword prompt; returns `[{ answer, clue, hint, sourceUrl }]` |
| `src/scripts/crossword-engine.js` | Pure-JS grid placement — places longest word first, then intersects remaining words by shared letters; scores by intersection count + center proximity |
| `public/player/player.js` | Self-contained player renderer; receives the puzzle object from `localStorage` or a base64 `?data=` URL param |
| `src/pages/api/scrape.ts` | Thin API route wrapping `scrapeUrl` |
| `src/pages/api/extract.ts` | Thin API route wrapping `extractWords`; reads `ANTHROPIC_API_KEY` from env |

### State model (`admin.js`)

```js
state.words = [{ answer, clue, hint, sourceUrl, priority }]
state.urls  = [{ url, status: 'idle'|'loading'|'ok'|'error' }]
```

Words with `priority: true` are sorted to the front before being passed to `generateCrossword()`. Clue and hint are editable inline via `contentEditable` cells. `generateCrossword()` accepts at most 15 words.

### Puzzle output format

```js
{
  grid: [[{ letter, isBlack, clueNumber }]],
  across: [{ number, answer, clue, hint, sourceUrl, row, col, length }],
  down:   [...],
  size:   { rows, cols },
  unused: [{ answer, ... }]
}
```

### Deployment

Deployed on Netlify. The adapter is `@astrojs/netlify`. `ANTHROPIC_API_KEY` must be set as a Netlify environment variable.
