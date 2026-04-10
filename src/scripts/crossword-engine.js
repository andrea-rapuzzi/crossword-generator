/**
 * crossword-engine.js
 * Pure JS crossword grid placement algorithm. No dependencies.
 *
 * Usage:
 *   import { generateCrossword } from './crossword-engine.js';
 *   const puzzle = generateCrossword(wordList);
 *
 * wordList: [{ answer, clue, hint, sourceUrl }]
 * Returns:  { grid, across, down, size, unused }
 */

const MIN_WORD_LEN = 3;
const MAX_GRID = 23;
const BUFFER = 1; // required empty cells at word endpoints

// ─── Public API ─────────────────────────────────────────────────────────────

export function generateCrossword(words) {
  // Filter and sort by length descending
  const valid = words
    .filter(w => w.answer && /^[A-Z]{3,}$/.test(w.answer.toUpperCase()))
    .map(w => ({ ...w, answer: w.answer.toUpperCase() }))
    .filter(w => w.answer.length >= MIN_WORD_LEN)
    .sort((a, b) => b.answer.length - a.answer.length);

  if (valid.length === 0) return emptyResult();

  // Initialize grid
  let grid = createGrid(MAX_GRID);
  const placed = [];
  const unused = [];

  // Place first word horizontally at center
  const first = valid[0];
  const startCol = Math.floor((MAX_GRID - first.answer.length) / 2);
  const startRow = Math.floor(MAX_GRID / 2);
  placeWord(grid, first, 'across', startRow, startCol, 0);
  placed.push({ ...first, direction: 'across', row: startRow, col: startCol, id: 0 });

  // Place remaining words
  for (let i = 1; i < valid.length; i++) {
    const word = valid[i];
    const best = findBestPlacement(grid, word, placed, i);
    if (best) {
      placeWord(grid, word, best.direction, best.row, best.col, i);
      placed.push({ ...word, direction: best.direction, row: best.row, col: best.col, id: i });
    } else {
      unused.push(word);
    }
  }

  // Normalize grid to bounding box
  const { trimmed, offsetRow, offsetCol } = trimGrid(grid, placed);

  // Adjust coordinates
  const normalized = placed.map(w => ({
    ...w,
    row: w.row - offsetRow,
    col: w.col - offsetCol,
  }));

  // Assign clue numbers
  const { across, down, numberedGrid } = assignClueNumbers(trimmed, normalized);

  return {
    grid: numberedGrid,
    across,
    down,
    size: { rows: trimmed.length, cols: trimmed[0].length },
    unused,
  };
}

// ─── Grid helpers ────────────────────────────────────────────────────────────

function createGrid(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ letter: null }))
  );
}

function getCell(grid, row, col) {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return null;
  return grid[row][col];
}

function placeWord(grid, word, direction, row, col, id) {
  for (let i = 0; i < word.answer.length; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    grid[r][c].letter = word.answer[i];
  }
}

// ─── Placement algorithm ─────────────────────────────────────────────────────

function findBestPlacement(grid, word, placed, id) {
  const candidates = [];

  for (const pw of placed) {
    for (let pi = 0; pi < pw.answer.length; pi++) {
      const pLetter = pw.answer[pi];
      const pRow = pw.direction === 'across' ? pw.row : pw.row + pi;
      const pCol = pw.direction === 'across' ? pw.col + pi : pw.col;

      for (let wi = 0; wi < word.answer.length; wi++) {
        if (word.answer[wi] !== pLetter) continue;

        const newDir = pw.direction === 'across' ? 'down' : 'across';
        const newRow = newDir === 'across' ? pRow : pRow - wi;
        const newCol = newDir === 'across' ? pCol - wi : pCol;

        if (!isValidPlacement(grid, word.answer, newDir, newRow, newCol)) continue;

        const score = scorePlacement(grid, word.answer, newDir, newRow, newCol);
        candidates.push({ direction: newDir, row: newRow, col: newCol, score });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function isValidPlacement(grid, answer, direction, row, col) {
  const len = answer.length;

  // Check bounds (leave BUFFER at edges)
  if (direction === 'across') {
    if (col - BUFFER < 0 || col + len + BUFFER > MAX_GRID) return false;
    if (row < 0 || row >= MAX_GRID) return false;
  } else {
    if (row - BUFFER < 0 || row + len + BUFFER > MAX_GRID) return false;
    if (col < 0 || col >= MAX_GRID) return false;
  }

  // Check each cell
  for (let i = 0; i < len; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    const cell = getCell(grid, r, c);
    if (!cell) return false;

    // Cell has a letter — must be the same (intersection)
    if (cell.letter !== null && cell.letter !== answer[i]) return false;

    // Parallel adjacency check (prevents side-by-side words)
    if (cell.letter === null) {
      if (direction === 'across') {
        const above = getCell(grid, r - 1, c);
        const below = getCell(grid, r + 1, c);
        if ((above?.letter) || (below?.letter)) {
          // Only allowed if this cell will be an intersection point — already occupied
          return false;
        }
      } else {
        const left = getCell(grid, r, c - 1);
        const right = getCell(grid, r, c + 1);
        if ((left?.letter) || (right?.letter)) {
          return false;
        }
      }
    }
  }

  // Check buffer cells before start
  if (direction === 'across') {
    if (getCell(grid, row, col - 1)?.letter) return false;
    if (getCell(grid, row, col + len)?.letter) return false;
  } else {
    if (getCell(grid, row - 1, col)?.letter) return false;
    if (getCell(grid, row + len, col)?.letter) return false;
  }

  return true;
}

function scorePlacement(grid, answer, direction, row, col) {
  let intersections = 0;
  for (let i = 0; i < answer.length; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    if (getCell(grid, r, c)?.letter === answer[i]) intersections++;
  }
  // Prefer more intersections and positions closer to center
  const centerDist = Math.abs(row - MAX_GRID / 2) + Math.abs(col - MAX_GRID / 2);
  return intersections * 10 - centerDist * 0.1;
}

// ─── Grid normalization ──────────────────────────────────────────────────────

function trimGrid(grid, placed) {
  if (placed.length === 0) return { trimmed: [[{ letter: null }]], offsetRow: 0, offsetCol: 0 };

  let minRow = MAX_GRID, maxRow = 0, minCol = MAX_GRID, maxCol = 0;
  for (const w of placed) {
    const endRow = w.direction === 'across' ? w.row : w.row + w.answer.length - 1;
    const endCol = w.direction === 'across' ? w.col + w.answer.length - 1 : w.col;
    minRow = Math.min(minRow, w.row);
    maxRow = Math.max(maxRow, endRow);
    minCol = Math.min(minCol, w.col);
    maxCol = Math.max(maxCol, endCol);
  }

  // Add 1-cell padding
  minRow = Math.max(0, minRow - 1);
  minCol = Math.max(0, minCol - 1);
  maxRow = Math.min(MAX_GRID - 1, maxRow + 1);
  maxCol = Math.min(MAX_GRID - 1, maxCol + 1);

  const trimmed = grid
    .slice(minRow, maxRow + 1)
    .map(row => row.slice(minCol, maxCol + 1));

  return { trimmed, offsetRow: minRow, offsetCol: minCol };
}

// ─── Clue numbering ──────────────────────────────────────────────────────────

function assignClueNumbers(grid, placed) {
  const rows = grid.length;
  const cols = grid[0].length;

  // Build a number map: key = "row,col" → number
  const numberMap = {};
  let num = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].letter) continue;
      const startsAcross = (c === 0 || !grid[r][c - 1]?.letter) &&
                           (c + 1 < cols && grid[r][c + 1]?.letter);
      const startsDown   = (r === 0 || !grid[r - 1]?.[c]?.letter) &&
                           (r + 1 < rows && grid[r + 1]?.[c]?.letter);
      if (startsAcross || startsDown) {
        numberMap[`${r},${c}`] = num++;
      }
    }
  }

  // Build final grid with clueNumber
  const numberedGrid = grid.map((row, r) =>
    row.map((cell, c) => ({
      letter: cell.letter,
      isBlack: cell.letter === null,
      clueNumber: numberMap[`${r},${c}`] || null,
    }))
  );

  // Build across/down lists
  const across = [];
  const down = [];

  for (const w of placed) {
    const numKey = `${w.row},${w.col}`;
    const clueNum = numberMap[numKey];
    if (!clueNum) continue;

    const entry = {
      number: clueNum,
      answer: w.answer,
      clue: w.clue,
      hint: w.hint,
      sourceUrl: w.sourceUrl,
      row: w.row,
      col: w.col,
      length: w.answer.length,
    };

    if (w.direction === 'across') across.push(entry);
    else down.push(entry);
  }

  across.sort((a, b) => a.number - b.number);
  down.sort((a, b) => a.number - b.number);

  return { across, down, numberedGrid };
}

function emptyResult() {
  return { grid: [], across: [], down: [], size: { rows: 0, cols: 0 }, unused: [] };
}
