import { generateCrossword } from './crossword-engine.js';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  urls: [],   // [{ url, status: 'idle'|'loading'|'ok'|'error' }]
  words: [],  // [{ answer, clue, hint, sourceUrl }]
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const langSelect    = document.getElementById('lang');
const urlInput      = document.getElementById('url-input');
const btnAddUrl     = document.getElementById('btn-add-url');
const urlListEl     = document.getElementById('url-list');
const btnScrape     = document.getElementById('btn-scrape');
const btnGenerate   = document.getElementById('btn-generate');
const logEl         = document.getElementById('log');
const wordsEmpty    = document.getElementById('words-empty');
const wordsTable    = document.getElementById('words-table');
const wordsBody     = document.getElementById('words-body');
const wordCount     = document.getElementById('word-count');
const btnClearWords  = document.getElementById('btn-clear-words');
const btnAddWord     = document.getElementById('btn-add-word');
const addWordForm    = document.getElementById('add-word-form');
const addAnswerInput = document.getElementById('add-answer');
const addClueInput   = document.getElementById('add-clue');
const addHintInput   = document.getElementById('add-hint');
const btnAddWordOk   = document.getElementById('btn-add-word-ok');
const btnAddWordCancel = document.getElementById('btn-add-word-cancel');
const addUrlInput      = document.getElementById('add-url');
const btnPreview    = document.getElementById('btn-preview');
const btnDemo       = document.getElementById('btn-demo');
const statusIcon    = document.getElementById('status-icon');
const statusLabel   = document.getElementById('status-label');
const progressFill  = document.getElementById('progress-fill');

// ─── Status panel ─────────────────────────────────────────────────────────────

const STAGES = {
  idle:       { label: 'Pronto',               state: 'idle'    },
  scraping:   { label: 'Scraping in corso…',    state: 'active'  },
  analyzing:  { label: 'Analisi del testo…',    state: 'active'  },
  extracting: { label: 'Estrazione parole…',    state: 'active'  },
  generating: { label: 'Generazione griglia…',  state: 'active'  },
  done:       { label: 'Completato!',           state: 'success' },
  error:      { label: 'Si è verificato un errore', state: 'error' },
};

let _resetTimer = null;

function setStatus(stage, progress = null) {
  const cfg = STAGES[stage] || STAGES.idle;

  statusLabel.textContent = cfg.label;
  statusLabel.className   = `status-label${cfg.state !== 'idle' ? ` status-label--${cfg.state}` : ''}`;
  statusIcon.className    = `status-icon${cfg.state !== 'idle' ? ` status-icon--${cfg.state}` : ''}`;

  if (progress !== null) {
    progressFill.style.width = `${progress}%`;
    progressFill.className   = `progress-fill${
      cfg.state === 'success' ? ' progress-fill--success' :
      cfg.state === 'error'   ? ' progress-fill--error'   : ''
    }`;
  }

  // Auto-reset to idle after terminal states
  clearTimeout(_resetTimer);
  if (stage === 'done' || stage === 'error') {
    _resetTimer = setTimeout(() => setStatus('idle', 0), 4000);
  }
}

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

  btnScrape.disabled = false;
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

// ─── Words table ──────────────────────────────────────────────────────────────

function renderWords() {
  const empty = state.words.length === 0;
  wordsEmpty.style.display    = empty ? '' : 'none';
  wordsTable.style.display    = empty ? 'none' : '';
  wordCount.style.display     = empty ? 'none' : '';
  btnClearWords.style.display = empty ? 'none' : '';
  btnGenerate.disabled        = empty;

  if (empty) return;

  wordCount.textContent = `${state.words.length} ${state.words.length === 1 ? 'parola' : 'parole'}`;
  wordsBody.innerHTML = '';

  state.words.forEach((w, i) => {
    const tr = document.createElement('tr');
    if (w.priority) tr.classList.add('word-priority-row');

    // ★ Priority
    const tdStar = document.createElement('td');
    tdStar.style.textAlign = 'center';
    const starBtn = document.createElement('button');
    starBtn.className = `word-priority${w.priority ? ' word-priority--active' : ''}`;
    starBtn.title = w.priority ? 'Rimuovi priorità' : 'Segna come prioritaria';
    starBtn.textContent = w.priority ? '★' : '☆';
    starBtn.addEventListener('click', () => {
      state.words[i].priority = !state.words[i].priority;
      renderWords();
    });
    tdStar.appendChild(starBtn);

    // Parola
    const tdAnswer = document.createElement('td');
    const answerSpan = document.createElement('span');
    answerSpan.className = 'word-answer';
    answerSpan.textContent = w.answer;
    tdAnswer.appendChild(answerSpan);

    // Indizio (editable)
    const tdClue = document.createElement('td');
    tdClue.className = 'word-clue word-editable';
    tdClue.contentEditable = 'true';
    tdClue.textContent = w.clue;
    tdClue.addEventListener('blur', () => { state.words[i].clue = tdClue.textContent.trim(); });

    // Suggerimento (editable)
    const tdHint = document.createElement('td');
    tdHint.className = 'word-hint word-editable';
    tdHint.contentEditable = 'true';
    tdHint.textContent = w.hint || '';
    tdHint.addEventListener('blur', () => { state.words[i].hint = tdHint.textContent.trim(); });

    // Fonte
    const tdSource = document.createElement('td');
    if (w.sourceUrl) {
      const a = document.createElement('a');
      a.href = w.sourceUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'word-source';
      a.title = w.sourceUrl;
      a.textContent = '↗';
      tdSource.appendChild(a);
    } else {
      tdSource.textContent = '—';
    }

    // Elimina
    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'word-del';
    delBtn.title = 'Rimuovi';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
      state.words.splice(i, 1);
      renderWords();
    });
    tdDel.appendChild(delBtn);

    tr.append(tdStar, tdAnswer, tdClue, tdHint, tdSource, tdDel);
    wordsBody.appendChild(tr);
  });
}

btnClearWords.addEventListener('click', () => {
  state.words = [];
  renderWords();
});

// ─── Add word manually ────────────────────────────────────────────────────────

function openAddWordForm() {
  addWordForm.style.display = 'flex';
  addAnswerInput.focus();
}

function closeAddWordForm() {
  addWordForm.style.display = 'none';
  addAnswerInput.value = '';
  addClueInput.value   = '';
  addHintInput.value   = '';
  addUrlInput.value    = '';
}

function commitAddWord() {
  const answer = addAnswerInput.value.trim().toUpperCase().replace(/\s+/g, '');
  const clue   = addClueInput.value.trim();
  if (!answer || !clue) { addAnswerInput.focus(); return; }
  if (state.words.find(w => w.answer === answer)) {
    log(`"${answer}" è già presente.`, 'error');
    return;
  }
  const sourceUrl = addUrlInput.value.trim();
  state.words.push({ answer, clue, hint: addHintInput.value.trim(), sourceUrl, priority: false });
  renderWords();
  closeAddWordForm();
  log(`Parola aggiunta manualmente: ${answer}`, 'ok');
}

btnAddWord.addEventListener('click', () => {
  addWordForm.style.display === 'none' ? openAddWordForm() : closeAddWordForm();
});
btnAddWordOk.addEventListener('click', commitAddWord);
btnAddWordCancel.addEventListener('click', closeAddWordForm);
addAnswerInput.addEventListener('keydown', e => { if (e.key === 'Enter') addClueInput.focus(); });
addClueInput.addEventListener('keydown',   e => { if (e.key === 'Enter') addHintInput.focus(); });
addHintInput.addEventListener('keydown',   e => { if (e.key === 'Enter') addUrlInput.focus(); });
addUrlInput.addEventListener('keydown',    e => { if (e.key === 'Enter') commitAddWord(); });

// ─── Scrape & Extract ─────────────────────────────────────────────────────────

btnScrape.addEventListener('click', async () => {
  const lang  = langSelect.value;
  const total = state.urls.length;

  if (total === 0) { log('Aggiungi almeno un URL.', 'error'); return; }

  btnScrape.disabled = true;
  btnScrape.innerHTML = '<span class="spinner"></span> Elaborazione…';

  let hasError = false;

  for (let i = 0; i < total; i++) {
    const entry     = state.urls[i];
    const sliceSize = 100 / total;
    const base      = i * sliceSize;

    entry.status = 'loading';
    renderUrls();

    log(`Scraping: ${entry.url}`);
    setStatus('scraping', base + sliceSize * 0.1);

    try {
      // 1. Scrape
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: entry.url }),
      });

      if (!scrapeRes.ok) throw new Error((await scrapeRes.json()).error);
      const { text } = await scrapeRes.json();

      setStatus('analyzing', base + sliceSize * 0.45);
      log(`Testo estratto (${text.length} char). Analisi con Claude…`);

      // 2. Extract — API key is managed server-side via .env
      setStatus('extracting', base + sliceSize * 0.65);
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceUrl: entry.url, lang }),
      });

      if (!extractRes.ok) throw new Error((await extractRes.json()).error);
      const { words } = await extractRes.json();

      // Deduplicate by answer
      const existing = new Set(state.words.map(w => w.answer));
      const added = words.filter(w => !existing.has(w.answer));
      state.words.push(...added);

      entry.status = 'ok';
      setStatus('extracting', base + sliceSize); // complete this URL's slice
      log(`+${added.length} parole da ${new URL(entry.url).hostname}`, 'ok');

    } catch (err) {
      hasError = true;
      entry.status = 'error';
      log(`Errore: ${err.message}`, 'error');
    }

    renderUrls();
    renderWords();
  }

  setStatus(hasError ? 'error' : 'done', 100);
  btnScrape.innerHTML = 'Scrape &amp; Estrai parole';
  btnScrape.disabled  = false;
});

// ─── Generate ─────────────────────────────────────────────────────────────────

btnGenerate.addEventListener('click', () => {
  if (state.words.length === 0) { log('Nessuna parola da usare.', 'error'); return; }

  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="spinner"></span> Generazione…';

  setStatus('generating', 30);
  setTimeout(() => {
    try {
      const sorted = [...state.words].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
      const input = sorted.slice(0, 15);
      log(`Avvio engine con ${input.length} parole…`);
      setStatus('generating', 70);

      const puzzle = generateCrossword(input);
      const placed = puzzle.across.length + puzzle.down.length;

      if (placed === 0) {
        log('Impossibile generare il cruciverba: parole troppo corte o incompatibili.', 'error');
        setStatus('error', 100);
        return;
      }

      log(`Griglia ${puzzle.size.cols}×${puzzle.size.rows} — ${placed} parole collocate, ${puzzle.unused.length} non usate.`, 'ok');
      setStatus('done', 100);

      localStorage.setItem('fdl_puzzle', JSON.stringify(puzzle));
      updatePreviewBtn();
      window.open('/player/', '_blank');

    } catch (err) {
      log('Errore durante la generazione: ' + err.message, 'error');
      setStatus('error', 100);
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

// ─── Demo ─────────────────────────────────────────────────────────────────────

const DEMO_WORDS = [
  { answer: 'CARBONARA',   clue: 'Pasta romana con guanciale e uova',           hint: 'Il piatto simbolo di Roma, con pecorino e pepe nero', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-di-pasta/carbonara-ricetta-originale/' },
  { answer: 'RISOTTO',     clue: 'Riso mantecato tipico del Nord Italia',        hint: 'La cottura lenta con brodo e il soffritto sono il segreto', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-di-riso/risotto-allo-zafferano/' },
  { answer: 'TARTUFO',     clue: 'Fungo ipogeo dal profumo inconfondibile',      hint: 'Il diamante della cucina si trova sotto terra', sourceUrl: 'https://www.finedininglovers.it/storie/curiosita/tartufo-bianco-pregiato/' },
  { answer: 'BURRATA',     clue: 'Formaggio pugliese dal cuore cremoso',         hint: 'Involucro di mozzarella che cela panna e stracciatella', sourceUrl: 'https://www.finedininglovers.it/storie/prodotti/burrata-formaggio/' },
  { answer: 'PESTO',       clue: 'Salsa genovese a base di basilico',            hint: 'Basilico, pinoli, parmigiano e olio ligure pestati nel mortaio', sourceUrl: 'https://www.finedininglovers.it/ricette/salse-e-sughi/pesto-genovese-ricetta-originale/' },
  { answer: 'MASCARPONE',  clue: 'Formaggio lombardo base del tiramisù',         hint: 'Cremoso e delicato, indispensabile nel dolce al cucchiaio più famoso', sourceUrl: 'https://www.finedininglovers.it/storie/prodotti/mascarpone-formaggio/' },
  { answer: 'AMARONE',     clue: 'Vino rosso potente della Valpolicella',        hint: 'Prodotto con uve appassite, è tra i grandi rossi italiani', sourceUrl: 'https://www.finedininglovers.it/storie/vino/amarone-della-valpolicella/' },
  { answer: 'ACETO',       clue: 'Condimento ottenuto per fermentazione',        hint: 'Quello balsamico di Modena è un presidio Slow Food', sourceUrl: 'https://www.finedininglovers.it/storie/prodotti/aceto-balsamico-di-modena/' },
  { answer: 'POLENTA',     clue: 'Piatto contadino di farina di mais',           hint: 'Norditaliana per eccellenza, si serve morbida o abbrustolita', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-vegetariane/polenta-classica/' },
  { answer: 'RAGÙ',        clue: 'Sugo di carne lento della tradizione',         hint: 'Quello bolognese si cuoce per ore con carni miste e pomodoro', sourceUrl: 'https://www.finedininglovers.it/ricette/salse-e-sughi/ragu-alla-bolognese-ricetta-originale/' },
  { answer: 'OSSOBUCO',    clue: 'Stinco di vitello in umido milanese',          hint: 'Si serve con la gremolada e il midollo è la parte più prelibata', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-di-carne/ossobuco-alla-milanese/' },
  { answer: 'CAPONATA',    clue: 'Agrodolce siciliano con melanzane',            hint: 'Cipolla, sedano, olive e capperi completano questo antipasto isolano', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-vegetariane/caponata-siciliana/' },
  { answer: 'LIMONCELLO',  clue: 'Liquore campano a base di scorze di limone',   hint: 'Il digestivo più iconico della Costiera Amalfitana', sourceUrl: 'https://www.finedininglovers.it/ricette/bevande-e-cocktail/limoncello-ricetta-originale/' },
  { answer: 'ARANCINO',    clue: 'Riso fritto ripieno tipico siciliano',         hint: 'La forma conica a Catania, rotonda a Palermo: la disputa continua', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-di-riso/arancini-siciliani/' },
  { answer: 'CANNOLO',     clue: 'Dolce siciliano con cialda fritta e ricotta',  hint: 'Il ripieno di ricotta di pecora è il vero segreto del pasticciere', sourceUrl: 'https://www.finedininglovers.it/ricette/ricette-di-dolci/cannoli-siciliani/' },
];

btnDemo.addEventListener('click', () => {
  state.words = DEMO_WORDS.map(w => ({ ...w, priority: false }));
  renderWords();
  log('Parole demo caricate. Generazione in corso…', 'ok');

  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="spinner"></span> Generazione…';
  setStatus('generating', 30);

  setTimeout(() => {
    try {
      const sorted = [...state.words].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
      const input  = sorted.slice(0, 15);
      setStatus('generating', 70);

      const puzzle = generateCrossword(input);
      const placed = puzzle.across.length + puzzle.down.length;

      if (placed === 0) {
        log('Impossibile generare la griglia demo.', 'error');
        setStatus('error', 100);
        return;
      }

      log(`Demo: griglia ${puzzle.size.cols}×${puzzle.size.rows} — ${placed} parole collocate.`, 'ok');
      setStatus('done', 100);
      localStorage.setItem('fdl_puzzle', JSON.stringify(puzzle));
      updatePreviewBtn();
      window.open('/player/', '_blank');
    } catch (err) {
      log('Errore demo: ' + err.message, 'error');
      setStatus('error', 100);
    } finally {
      btnGenerate.innerHTML = 'Genera Cruciverba';
      btnGenerate.disabled  = state.words.length === 0;
    }
  }, 50);
});

// ─── Init ─────────────────────────────────────────────────────────────────────

renderUrls();
renderWords();
updatePreviewBtn();
