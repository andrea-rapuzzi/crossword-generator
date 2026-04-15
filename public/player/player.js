/* ─── FDL Crossword Player ────────────────────────────────────────────────── */
/* Vanilla JS, no dependencies. Embed via:                                    */
/*   <script src="player.js"></script>                                         */
/*   <script>FDLCrossword.init(el, puzzleData)</script>                        */

(function () {
  'use strict';

  /* ── Utils ──────────────────────────────────────────────────────────────── */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function cellKey(r, c) { return r + ',' + c; }

  /* ── Word map ────────────────────────────────────────────────────────────── */
  // wordMap[key] = { across: clueNumber|null, down: clueNumber|null }

  function buildWordMap(puzzle) {
    const map = {};
    for (const w of puzzle.across) {
      for (let i = 0; i < w.length; i++) {
        const k = cellKey(w.row, w.col + i);
        if (!map[k]) map[k] = { across: null, down: null };
        map[k].across = w.number;
      }
    }
    for (const w of puzzle.down) {
      for (let i = 0; i < w.length; i++) {
        const k = cellKey(w.row + i, w.col);
        if (!map[k]) map[k] = { across: null, down: null };
        map[k].down = w.number;
      }
    }
    return map;
  }

  function getClue(puzzle, number, dir) {
    return puzzle[dir].find(w => w.number === number) || null;
  }

  function getWordCells(clue, dir) {
    const cells = [];
    for (let i = 0; i < clue.length; i++) {
      cells.push({
        r: dir === 'across' ? clue.row       : clue.row + i,
        c: dir === 'across' ? clue.col + i   : clue.col,
      });
    }
    return cells;
  }

  function orderedClues(puzzle) {
    return [
      ...puzzle.across.map(w => ({ ...w, dir: 'across' })),
      ...puzzle.down.map(w => ({ ...w, dir: 'down' })),
    ];
  }

  /* ── Selection ───────────────────────────────────────────────────────────── */

  function selectCell(state, r, c) {
    // [P2] Dismiss mobile scroll hint on first explicit cell tap
    if (state.scrollHint && !state.scrollHint.classList.contains('cw-scroll-hint--hidden')) {
      state.scrollHint.classList.add('cw-scroll-hint--hidden');
    }
    const info = state.wordMap[cellKey(r, c)];
    if (!info) return;

    let dir = state.sel ? state.sel.dir : 'across';

    if (state.sel && state.sel.r === r && state.sel.c === c) {
      if (info.across && info.down) dir = dir === 'across' ? 'down' : 'across';
    } else {
      if (!info[dir]) dir = dir === 'across' ? 'down' : 'across';
    }

    const clueNumber = info[dir];
    if (!clueNumber) return;

    state.sel = { r, c, dir, clueNumber };
    renderAll(state);
    focusHidden(state);
  }

  function selectByClue(state, number, dir, scroll) {
    const clue = getClue(state.puzzle, number, dir);
    if (!clue) return;
    const cells = getWordCells(clue, dir);
    const target = cells.find(({ r, c }) => !state.userGrid[r][c]) || cells[0];
    state.sel = { r: target.r, c: target.c, dir, clueNumber: number };
    renderAll(state);
    focusHidden(state);
    if (scroll) scrollClue(state, number, dir);
  }

  /* ── Input ───────────────────────────────────────────────────────────────── */

  function wordKey(num, dir) { return num + ':' + dir; }

  function isWordFilled(state, clue, dir) {
    return getWordCells(clue, dir).every(({ r, c }) => !!state.userGrid[r][c]);
  }

  function autoCheckWord(state, clue, dir, key) {
    const cells = getWordCells(clue, dir);
    const typed  = cells.map(({ r, c }) => state.userGrid[r][c] || '').join('');
    const answer = clue.answer.toUpperCase();

    if (typed === answer) {
      state.wordCorrect.add(key);
      renderCells(state);
      // Brief cyan→green flash to signal success
      cells.forEach(({ r, c }) => {
        const div = state.cells[cellKey(r, c)];
        if (div) {
          div.classList.add('cw-cell--auto-correct');
          setTimeout(() => div.classList.remove('cw-cell--auto-correct'), 500);
        }
      });
    } else {
      // Brief red flash to signal the word is wrong — don't block navigation
      cells.forEach(({ r, c }) => {
        const div = state.cells[cellKey(r, c)];
        if (div) {
          div.classList.add('cw-cell--flash-wrong');
          setTimeout(() => div.classList.remove('cw-cell--flash-wrong'), 700);
        }
      });
    }
  }

  function inputLetter(state, ch) {
    if (!state.sel) return;
    const { r, c, clueNumber, dir } = state.sel;

    // If re-editing a previously auto-verified word, un-verify it
    const key = wordKey(clueNumber, dir);
    if (state.wordCorrect.has(key)) state.wordCorrect.delete(key);

    state.userGrid[r][c] = ch;
    state.checked = false;
    renderCells(state);
    advance(state);

    // Auto-check: did we just complete this word?
    const clue = getClue(state.puzzle, clueNumber, dir);
    if (clue && isWordFilled(state, clue, dir) && !state.wordCorrect.has(key)) {
      autoCheckWord(state, clue, dir, key);
    }

    checkComplete(state);
  }

  function backspace(state) {
    if (!state.sel) return;
    const { r, c } = state.sel;
    if (state.userGrid[r][c]) {
      state.userGrid[r][c] = '';
      state.checked = false;
      renderCells(state);
    } else {
      retreat(state);
      if (state.sel) {
        state.userGrid[state.sel.r][state.sel.c] = '';
        state.checked = false;
        renderCells(state);
      }
    }
  }

  function advance(state) {
    const { sel, puzzle } = state;
    const clue = getClue(puzzle, sel.clueNumber, sel.dir);
    if (!clue) return;
    const cells = getWordCells(clue, sel.dir);
    const idx = cells.findIndex(({ r, c }) => r === sel.r && c === sel.c);
    if (idx < cells.length - 1) {
      const next = cells[idx + 1];
      state.sel = { ...sel, r: next.r, c: next.c };
      renderAll(state);
    } else {
      nextClue(state);
    }
  }

  function retreat(state) {
    const { sel, puzzle } = state;
    const clue = getClue(puzzle, sel.clueNumber, sel.dir);
    if (!clue) return;
    const cells = getWordCells(clue, sel.dir);
    const idx = cells.findIndex(({ r, c }) => r === sel.r && c === sel.c);
    if (idx > 0) {
      const prev = cells[idx - 1];
      state.sel = { ...sel, r: prev.r, c: prev.c };
      renderAll(state);
    }
  }

  function nextClue(state) {
    const list = orderedClues(state.puzzle);
    if (!list.length) return;
    const { sel } = state;
    const idx = list.findIndex(w => w.number === sel?.clueNumber && w.dir === sel?.dir);
    const next = list[(idx + 1) % list.length];
    selectByClue(state, next.number, next.dir, true);
  }

  function prevClue(state) {
    const list = orderedClues(state.puzzle);
    if (!list.length) return;
    const { sel } = state;
    const idx = list.findIndex(w => w.number === sel?.clueNumber && w.dir === sel?.dir);
    const prev = list[(idx - 1 + list.length) % list.length];
    selectByClue(state, prev.number, prev.dir, true);
  }

  function navigateArrow(state, key) {
    if (!state.sel) return;
    let { r, c } = state.sel;
    const { puzzle, wordMap } = state;

    const delta = { ArrowRight:[0,1], ArrowLeft:[0,-1], ArrowDown:[1,0], ArrowUp:[-1,0] }[key];
    if (!delta) return;
    const nr = r + delta[0], nc = c + delta[1];

    if (nr < 0 || nr >= puzzle.size.rows || nc < 0 || nc >= puzzle.size.cols) return;
    if (puzzle.grid[nr][nc].isBlack) return;

    const info = wordMap[cellKey(nr, nc)];
    if (!info) return;

    const arrowDir = (key === 'ArrowRight' || key === 'ArrowLeft') ? 'across' : 'down';
    const dir = info[arrowDir] ? arrowDir : (arrowDir === 'across' ? 'down' : 'across');
    const clueNumber = info[dir];
    if (!clueNumber) return;

    state.sel = { r: nr, c: nc, dir, clueNumber };
    renderAll(state);
    focusHidden(state);
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */

  function renderAll(state) {
    renderCells(state);
    renderClues(state);
    renderActiveBar(state);
  }

  function renderCells(state) {
    const { puzzle, userGrid, sel, cells, checked, wordCorrect } = state;

    // Build set of cells belonging to auto-verified correct words
    const autoCorrectCells = new Set();
    if (wordCorrect && wordCorrect.size > 0) {
      for (const k of wordCorrect) {
        const [numStr, d] = k.split(':');
        const clue = getClue(puzzle, +numStr, d);
        if (clue) getWordCells(clue, d).forEach(({ r, c }) => autoCorrectCells.add(cellKey(r, c)));
      }
    }

    const wordSet = new Set();
    if (sel) {
      const clue = getClue(puzzle, sel.clueNumber, sel.dir);
      if (clue) getWordCells(clue, sel.dir).forEach(({ r, c }) => wordSet.add(cellKey(r, c)));
    }

    for (let r = 0; r < puzzle.size.rows; r++) {
      for (let c = 0; c < puzzle.size.cols; c++) {
        const cell = puzzle.grid[r][c];
        if (cell.isBlack) continue;
        const div = cells[cellKey(r, c)];
        if (!div) continue;

        div.querySelector('.cw-letter').textContent = userGrid[r][c] || '';

        const isSelected = sel && sel.r === r && sel.c === c;
        const inWord = wordSet.has(cellKey(r, c)) && !isSelected;
        const isAutoCorrect = autoCorrectCells.has(cellKey(r, c));

        div.classList.toggle('cw-cell--selected', !!isSelected);
        div.classList.toggle('cw-cell--in-word', inWord && !isAutoCorrect);

        if (checked && userGrid[r][c]) {
          const ok = userGrid[r][c] === cell.letter;
          div.classList.toggle('cw-cell--correct', ok);
          div.classList.toggle('cw-cell--wrong', !ok);
        } else if (isAutoCorrect) {
          div.classList.add('cw-cell--correct');
          div.classList.remove('cw-cell--wrong');
        } else {
          div.classList.remove('cw-cell--correct', 'cw-cell--wrong');
        }
      }
    }
  }

  function renderClues(state) {
    if (!state.clueEls) return;
    for (const dir of ['across', 'down']) {
      for (const [, e] of Object.entries(state.clueEls[dir])) {
        e.classList.remove('cw-clue--active');
      }
    }
    if (!state.sel) return;
    const activeEl = state.clueEls[state.sel.dir]?.[state.sel.clueNumber];
    if (activeEl) activeEl.classList.add('cw-clue--active');
  }

  function renderActiveBar(state) {
    const bar = state.activeBarEl;
    if (!bar || !state.sel) return;

    // [P1] Clear verify error state when user moves to a new clue
    if (bar.classList.contains('cw-active-bar--error')) {
      bar.classList.remove('cw-active-bar--error');
      if (state._verifyTimer) { clearTimeout(state._verifyTimer); state._verifyTimer = null; }
    }

    const clue = getClue(state.puzzle, state.sel.clueNumber, state.sel.dir);
    if (!clue) return;
    const dirLabel = state.sel.dir === 'across' ? 'Orizzontale' : 'Verticale';
    bar.querySelector('.cw-active-label').textContent = clue.number + ' ' + dirLabel;
    bar.querySelector('.cw-active-clue').textContent = clue.clue;
    const hintLink = bar.querySelector('.cw-active-hint');
    if (clue.sourceUrl) {
      hintLink.href = clue.sourceUrl;
      hintLink.style.display = '';
    } else {
      hintLink.style.display = 'none';
    }
  }

  function scrollClue(state, number, dir) {
    const e = state.clueEls?.[dir]?.[number];
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Check / verify ──────────────────────────────────────────────────────── */

  function checkComplete(state) {
    const { puzzle, userGrid } = state;
    for (let r = 0; r < puzzle.size.rows; r++) {
      for (let c = 0; c < puzzle.size.cols; c++) {
        const cell = puzzle.grid[r][c];
        if (!cell.isBlack && userGrid[r][c] !== cell.letter) return false;
      }
    }
    showSuccess(state);
    return true;
  }

  /* [P1] Count filled cells that are wrong */
  function countErrors(state) {
    var count = 0;
    for (var r = 0; r < state.puzzle.size.rows; r++) {
      for (var c = 0; c < state.puzzle.size.cols; c++) {
        var cell = state.puzzle.grid[r][c];
        if (!cell.isBlack && state.userGrid[r][c] && state.userGrid[r][c] !== cell.letter) count++;
      }
    }
    return count;
  }

  /* [P1] Show transient error feedback in the active bar */
  function showVerifyFeedback(state, errorCount) {
    var bar = state.activeBarEl;
    if (!bar) return;
    var label = bar.querySelector('.cw-active-label');
    var clueEl = bar.querySelector('.cw-active-clue');
    var hint = bar.querySelector('.cw-active-hint');
    if (label) label.textContent = errorCount === 1 ? '1 errore' : errorCount + ' errori';
    if (clueEl) clueEl.textContent = 'correggi e riprova';
    if (hint) hint.style.display = 'none';
    bar.classList.add('cw-active-bar--error');
    if (state._verifyTimer) clearTimeout(state._verifyTimer);
    state._verifyTimer = setTimeout(function () {
      bar.classList.remove('cw-active-bar--error');
      state._verifyTimer = null;
      renderActiveBar(state);
    }, 4000);
  }

  function manualCheck(state) {
    state.checked = true;
    renderCells(state);
    if (!checkComplete(state)) {
      var errors = countErrors(state);
      if (errors > 0) showVerifyFeedback(state, errors);
    }
  }

  /* ── Success overlay ─────────────────────────────────────────────────────── */

  function showSuccess(state) {
    const overlay = el('div', 'cw-success');
    const card = el('div', 'cw-success-card');
    const h2 = el('h2', '', 'Complimenti!');
    const p = el('p', '', 'Hai completato il cruciverba gastronomico.');
    const btn = el('button', 'cw-success-close', 'Chiudi');
    btn.addEventListener('click', () => overlay.remove());
    card.append(h2, p, btn);
    overlay.appendChild(card);
    state.container.appendChild(overlay);
    // Update verify button state
    if (state.verifyBtn) {
      state.verifyBtn.textContent = '✓ Risolto!';
      state.verifyBtn.classList.add('cw-btn-verify--success');
    }
  }

  /* ── Embed download ──────────────────────────────────────────────────────── */

  async function generateEmbed(puzzle) {
    try {
      const [css, js] = await Promise.all([
        fetch('/player/player.css').then(r => r.text()),
        fetch('/player/player.js').then(r => r.text()),
      ]);

      const html = [
        '<!DOCTYPE html>',
        '<html lang="it">',
        '<head>',
        '  <meta charset="UTF-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">',
        '  <title>FDL Crossword</title>',
        '  <style>' + css + '</style>',
        '</head>',
        '<body>',
        '  <div id="cw"></div>',
        '  <script>' + js + '<\/script>',
        '  <script>',
        '    window.__CROSSWORD__ = ' + JSON.stringify(puzzle) + ';',
        '    FDLCrossword.init(document.getElementById(\'cw\'), window.__CROSSWORD__);',
        '  <\/script>',
        '</body>',
        '</html>',
      ].join('\n');

      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fdl-crossword.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Embed generation failed:', err);
    }
  }

  /* ── DOM builders ────────────────────────────────────────────────────────── */

  function buildGrid(state) {
    const { puzzle } = state;
    const scroll = el('div', 'cw-grid-scroll');
    const grid = el('div', 'cw-grid');
    grid.style.setProperty('--cols', puzzle.size.cols);
    grid.style.setProperty('--rows', puzzle.size.rows);

    state.cells = {};

    puzzle.grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const div = el('div', cell.isBlack ? 'cw-cell cw-cell--black' : 'cw-cell');
        div.dataset.row = r;
        div.dataset.col = c;
        if (!cell.isBlack) {
          if (cell.clueNumber) div.appendChild(el('span', 'cw-num', cell.clueNumber));
          div.appendChild(el('span', 'cw-letter'));
          state.cells[cellKey(r, c)] = div;
          div.addEventListener('click', () => selectCell(state, r, c));
        }
        grid.appendChild(div);
      });
    });

    scroll.appendChild(grid);
    setupGridZoom(scroll, grid);
    return scroll;
  }

  function buildActiveBar(state) {
    const bar = el('div', 'cw-active-bar');

    // Row 1: clue identity (number + separator + clue text)
    const info = el('div', 'cw-active-info');
    info.appendChild(el('span', 'cw-active-label'));
    info.appendChild(el('span', 'cw-active-sep', ' — '));
    info.appendChild(el('span', 'cw-active-clue'));
    bar.appendChild(info);

    // Row 2: action buttons
    const actions = el('div', 'cw-active-actions');

    const verifyBtn = el('button', 'cw-btn-verify', 'Verifica');
    state.verifyBtn = verifyBtn;
    actions.appendChild(verifyBtn);

    const hint = el('a', 'cw-active-hint', 'Leggi l\'articolo ↗');
    hint.target = '_blank';
    hint.rel = 'noopener noreferrer';
    hint.style.display = 'none';
    actions.appendChild(hint);

    bar.appendChild(actions);

    state.activeBarEl = bar;
    return bar;
  }

  function buildClues(state) {
    const { puzzle } = state;
    state.clueEls = { across: {}, down: {} };
    const section = el('div', 'cw-clues');

    for (const dir of ['across', 'down']) {
      const col = el('div', 'cw-clues-col');
      col.appendChild(el('h3', 'cw-clues-title', dir === 'across' ? 'Orizzontali' : 'Verticali'));
      const list = el('ul', 'cw-clues-list');

      for (const w of puzzle[dir]) {
        const item = el('li', 'cw-clue');
        item.appendChild(el('span', 'cw-clue-num', w.number + '.'));
        item.appendChild(el('span', 'cw-clue-text', w.clue));

        item.addEventListener('click', (e) => {
          if (e.target.tagName === 'A') return;
          selectByClue(state, w.number, dir, true);
        });

        state.clueEls[dir][w.number] = item;
        list.appendChild(item);
      }

      col.appendChild(list);
      section.appendChild(col);
    }

    return section;
  }

  function focusHidden(state) {
    state.hiddenInput?.focus({ preventScroll: true });
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  function setupEvents(state) {
    const input = state.hiddenInput;

    input.addEventListener('input', () => {
      const val = input.value.replace(/[^a-zA-ZÀ-ú]/g, '').toUpperCase();
      input.value = '';
      if (val) inputLetter(state, val.slice(-1));
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') { e.preventDefault(); backspace(state); }
      else if (e.key.startsWith('Arrow')) { e.preventDefault(); navigateArrow(state, e.key); }
      else if (e.key === 'Tab') { e.preventDefault(); e.shiftKey ? prevClue(state) : nextClue(state); }
      else if (e.key === 'Escape') { input.blur(); }
    });

    state.container.addEventListener('click', () => focusHidden(state));
  }

  /* ── Pinch-to-zoom + pan ─────────────────────────────────────────────────── */

  function setupGridZoom(scrollEl, gridEl) {
    var scale = 1, tx = 0, ty = 0;
    var t0 = [], initScale = 1, initTx = 0, initTy = 0;
    var initDist = 0, initMidX = 0, initMidY = 0;
    var moved = false;
    var MIN = 0.5, MAX = 4;

    function apply() {
      gridEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }

    function ptDist(a, b) {
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    }

    scrollEl.addEventListener('touchstart', function (e) {
      t0 = Array.from(e.touches);
      initScale = scale; initTx = tx; initTy = ty; moved = false;
      if (t0.length === 2) {
        initDist = ptDist(t0[0], t0[1]);
        var rect = scrollEl.getBoundingClientRect();
        initMidX = (t0[0].clientX + t0[1].clientX) / 2 - rect.left;
        initMidY = (t0[0].clientY + t0[1].clientY) / 2 - rect.top;
      }
    }, { passive: true });

    scrollEl.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var ts = Array.from(e.touches);
      if (ts.length === 1 && t0.length === 1) {
        var dx = ts[0].clientX - t0[0].clientX;
        var dy = ts[0].clientY - t0[0].clientY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
        tx = initTx + dx;
        ty = initTy + dy;
      } else if (ts.length >= 2 && t0.length >= 2) {
        moved = true;
        var d = ptDist(ts[0], ts[1]);
        var s = Math.max(MIN, Math.min(MAX, initScale * (d / initDist)));
        var ratio = s / initScale;
        tx = initMidX - ratio * (initMidX - initTx);
        ty = initMidY - ratio * (initMidY - initTy);
        scale = s;
      }
      apply();
    }, { passive: false });

    scrollEl.addEventListener('touchend', function () { t0 = []; });

    /* Suppress cell click if touch turned into a pan/pinch */
    scrollEl.addEventListener('click', function (e) {
      if (moved) { moved = false; e.stopPropagation(); }
    }, true);
  }

  /* ── Responsive cell sizing ──────────────────────────────────────────────── */

  function applyCellSize(container, cols, rows) {
    var scrollEl = container.querySelector('.cw-grid-scroll');
    var w = scrollEl ? scrollEl.clientWidth  : container.clientWidth;
    var h = scrollEl ? scrollEl.clientHeight : Math.round(window.innerHeight * 0.75);
    var isMobile = window.innerWidth <= 767;
    var size;
    if (isMobile) {
      // Show ~62% of cols at landing — cells are larger, grid overflows and user pans
      size = Math.max(24, Math.min(44, Math.floor(w / (cols * 0.62))));
    } else {
      var byW = Math.floor(w / cols);
      var byH = Math.floor(h / rows);
      size = Math.max(10, Math.min(44, byW, byH));
    }
    container.style.setProperty('--cell', size + 'px');
  }

  /* ── Init ────────────────────────────────────────────────────────────────── */

  function init(container, puzzle) {
    container.innerHTML = '';
    container.className = 'cw-root';

    const state = {
      puzzle,
      userGrid: puzzle.grid.map(row => row.map(() => '')),
      sel: null,
      wordMap: buildWordMap(puzzle),
      cells: {},
      clueEls: null,
      activeBarEl: null,
      verifyBtn: null,
      hiddenInput: null,
      checked: false,
      wordCorrect: new Set(), // keys "number:dir" of auto-verified correct words
      container,
    };

    // ── Header ──────────────────────────────────────────────────────────────
    const header = el('header', 'cw-header');

    const back = el('a', 'cw-header-back', '← Admin');
    back.href = '/';

    const logo = el('div', 'cw-header-logo');
    logo.innerHTML = 'FDL <span>Crossword</span>';

    const actions = el('div', 'cw-header-actions');
    const downloadBtn = el('button', 'cw-btn cw-btn--ghost', 'Scarica embed');
    downloadBtn.addEventListener('click', () => generateEmbed(puzzle));
    actions.appendChild(downloadBtn);

    header.append(back, logo, actions);

    // ── Game area ────────────────────────────────────────────────────────────
    const game = el('div', 'cw-game');

    // Left: grid only
    const gridCol = el('div', 'cw-grid-col');
    gridCol.appendChild(buildGrid(state));

    // [P2] Mobile hint — disappears on first cell interaction
    const scrollHint = el('div', 'cw-scroll-hint', '↓ scorri per gli indizi');
    state.scrollHint = scrollHint;
    gridCol.appendChild(scrollHint);

    // Right panel: active bar + clues
    const panel = el('div', 'cw-panel');
    panel.appendChild(buildActiveBar(state));
    panel.appendChild(buildClues(state));

    game.append(gridCol, panel);

    // ── Hidden input for mobile keyboard ─────────────────────────────────────
    const hiddenInput = el('input', 'cw-hidden-input');
    hiddenInput.setAttribute('type', 'text');
    hiddenInput.setAttribute('autocomplete', 'off');
    hiddenInput.setAttribute('autocorrect', 'off');
    hiddenInput.setAttribute('autocapitalize', 'characters');
    hiddenInput.setAttribute('spellcheck', 'false');
    hiddenInput.setAttribute('inputmode', 'text');
    state.hiddenInput = hiddenInput;

    container.append(header, game, hiddenInput);

    setupEvents(state);

    // Wire verify button (built inside buildActiveBar)
    state.verifyBtn.addEventListener('click', () => manualCheck(state));

    // Responsive cell sizing — double rAF ensures layout is fully settled
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyCellSize(container, puzzle.size.cols, puzzle.size.rows);
      });
    });
    const ro = new ResizeObserver(() => applyCellSize(container, puzzle.size.cols, puzzle.size.rows));
    ro.observe(container);

    // Select first clue
    if (puzzle.across[0]) selectByClue(state, puzzle.across[0].number, 'across', false);
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */

  window.FDLCrossword = { init };
})();
