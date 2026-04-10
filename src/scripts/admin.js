import { generateCrossword } from './crossword-engine.js';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  urls: [],   // [{ url, status: 'idle'|'loading'|'ok'|'error' }]
  words: [],  // [{ answer, clue, hint, sourceUrl }]
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const apiKeyInput  = document.getElementById('api-key');
const langSelect   = document.getElementById('lang');
const urlInput     = document.getElementById('url-input');
const btnAddUrl    = document.getElementById('btn-add-url');
const urlListEl    = document.getElementById('url-list');
const btnScrape    = document.getElementById('btn-scrape');
const btnGenerate  = document.getElementById('btn-generate');
const logEl        = document.getElementById('log');
const wordsEmpty   = document.getElementById('words-empty');
const wordsTable   = document.getElementById('words-table');
const wordsBody    = document.getElementById('words-body');
const wordCount    = document.getElementById('word-count');
const btnClearWords = document.getElementById('btn-clear-words');
const btnPreview    = document.getElementById('btn-preview');

// ─── Log ─────────────────────────────────────────────────────────────────────

function log(msg, type = '') {
  const line = document.createElement('span');
  line.className = `log__line${type ? ` log__line--${type}` : ''}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// ─── URL list ─────────────────────────────────────────────────────────────────

function renderUrls() {
  urlListEl.innerHTML = '';

  if (state.urls.length === 0) {
    urlListEl.innerHTML = '<p class="url-empty">Nessun URL aggiunto</p>';
    btnScrape.disabled = true;
    return;
  }

  state.urls.forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'url-item';
    item.dataset.index = i;

    const dot = document.createElement('span');
    dot.className = `url-item__status url-item__status--${entry.status === 'idle' ? '' : entry.status}`;

    const text = document.createElement('span');
    text.className = 'url-item__text';
    text.title = entry.url;
    text.textContent = entry.url;

    const del = document.createElement('button');
    del.className = 'url-item__remove';
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.urls.splice(i, 1);
      renderUrls();
    });

    item.append(dot, text, del);
    urlListEl.appendChild(item);
  });

  btnScrape.disabled = !apiKeyInput.value.trim();
}

function addUrl() {
  const url = urlInput.value.trim();
  if (!url || !/^https?:\/\/.+/.test(url)) return;
  if (state.urls.find(e => e.url === url)) {
    log('URL già presente.', 'error');
    return;
  }
  state.urls.push({ url, status: 'idle' });
  urlInput.value = '';
  renderUrls();
}

btnAddUrl.addEventListener('click', addUrl);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addUrl(); });
apiKeyInput.addEventListener('input', () => {
  btnScrape.disabled = state.urls.length === 0 || !apiKeyInput.value.trim();
});

// ─── Words table ──────────────────────────────────────────────────────────────

function renderWords() {
  const empty = state.words.length === 0;
  wordsEmpty.style.display  = empty ? '' : 'none';
  wordsTable.style.display  = empty ? 'none' : '';
  wordCount.style.display   = empty ? 'none' : '';
  btnClearWords.style.display = empty ? 'none' : '';
  btnGenerate.disabled      = empty;

  if (empty) return;

  wordCount.textContent = `${state.words.length} parole`;
  wordsBody.innerHTML = '';

  state.words.forEach((w, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="word-answer">${w.answer}</span></td>
      <td class="word-clue">${w.clue}</td>
      <td class="word-hint">${w.hint || '—'}</td>
      <td>${w.sourceUrl ? `<a href="${w.sourceUrl}" target="_blank" rel="noopener" class="word-source" title="${w.sourceUrl}">↗</a>` : '—'}</td>
      <td><button class="word-del" data-i="${i}" title="Rimuovi">×</button></td>
    `;
    wordsBody.appendChild(tr);
  });

  wordsBody.querySelectorAll('.word-del').forEach(btn => {
    btn.addEventListener('click', () => {
      state.words.splice(Number(btn.dataset.i), 1);
      renderWords();
    });
  });
}

btnClearWords.addEventListener('click', () => {
  state.words = [];
  renderWords();
});

// ─── Scrape & Extract ─────────────────────────────────────────────────────────

btnScrape.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const lang   = langSelect.value;

  if (!apiKey) { log('Inserisci la Claude API Key.', 'error'); return; }
  if (state.urls.length === 0) { log('Aggiungi almeno un URL.', 'error'); return; }

  btnScrape.disabled = true;
  btnScrape.innerHTML = '<span class="spinner"></span> Elaborazione…';

  for (let i = 0; i < state.urls.length; i++) {
    const entry = state.urls[i];
    entry.status = 'loading';
    renderUrls();

    log(`Scraping: ${entry.url}`);

    try {
      // 1. Scrape
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: entry.url }),
      });

      if (!scrapeRes.ok) throw new Error((await scrapeRes.json()).error);
      const { text } = await scrapeRes.json();
      log(`Testo estratto (${text.length} char). Invio a Claude…`);

      // 2. Extract
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceUrl: entry.url, lang, apiKey }),
      });

      if (!extractRes.ok) throw new Error((await extractRes.json()).error);
      const { words } = await extractRes.json();

      // Deduplicate by answer
      const existing = new Set(state.words.map(w => w.answer));
      const added = words.filter(w => !existing.has(w.answer));
      state.words.push(...added);

      entry.status = 'ok';
      log(`+${added.length} parole da ${new URL(entry.url).hostname}`, 'ok');

    } catch (err) {
      entry.status = 'error';
      log(`Errore: ${err.message}`, 'error');
    }

    renderUrls();
    renderWords();
  }

  btnScrape.innerHTML = 'Scrape &amp; Estrai parole';
  btnScrape.disabled  = false;
});

// ─── Generate ─────────────────────────────────────────────────────────────────

btnGenerate.addEventListener('click', () => {
  if (state.words.length === 0) { log('Nessuna parola da usare.', 'error'); return; }

  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="spinner"></span> Generazione…';

  // Slight delay so spinner renders before synchronous engine work
  setTimeout(() => {
    try {
      // Take up to 15 words (engine will place ~10 with good intersections)
      const input = state.words.slice(0, 15);
      log(`Avvio engine con ${input.length} parole…`);

      const puzzle = generateCrossword(input);
      const placed = puzzle.across.length + puzzle.down.length;

      if (placed === 0) {
        log('Impossibile generare il cruciverba: parole troppo corte o incompatibili.', 'error');
        return;
      }

      log(`Griglia ${puzzle.size.cols}×${puzzle.size.rows} — ${placed} parole collocate, ${puzzle.unused.length} non usate.`, 'ok');

      // Store and open player
      localStorage.setItem('fdl_puzzle', JSON.stringify(puzzle));
      updatePreviewBtn();
      window.open('/player/', '_blank');

    } catch (err) {
      log('Errore durante la generazione: ' + err.message, 'error');
    } finally {
      btnGenerate.innerHTML = 'Genera Cruciverba';
      btnGenerate.disabled = state.words.length === 0;
    }
  }, 50);
});

// ─── Preview button ───────────────────────────────────────────────────────────

function updatePreviewBtn() {
  btnPreview.disabled = !localStorage.getItem('fdl_puzzle');
}

btnPreview.addEventListener('click', () => window.open('/player/', '_blank'));

// ─── Init ─────────────────────────────────────────────────────────────────────

renderUrls();
renderWords();
updatePreviewBtn();
