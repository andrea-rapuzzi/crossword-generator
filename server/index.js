import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeUrl } from './scraper.js';
import { extractWords } from './extractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve admin UI from /admin
app.use('/', express.static(path.join(__dirname, '..', 'admin')));
app.use('/generator', express.static(path.join(__dirname, '..', 'generator')));
app.use('/player', express.static(path.join(__dirname, '..', 'player')));

// POST /scrape — fetch and clean text from a URL
app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url || !/^https?:\/\/.+/.test(url)) {
    return res.status(400).json({ error: 'URL non valida' });
  }
  try {
    const result = await scrapeUrl(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /extract — extract words and clues using Claude API
app.post('/extract', async (req, res) => {
  const { text, sourceUrl, lang, apiKey } = req.body;
  if (!text || !apiKey) {
    return res.status(400).json({ error: 'text e apiKey sono richiesti' });
  }
  try {
    const words = await extractWords({ text, sourceUrl, lang: lang || 'it', apiKey });
    res.json({ words });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🍴 FDL Crossword Generator`);
  console.log(`   Server: http://localhost:${PORT}`);
  console.log(`   Admin:  http://localhost:${PORT}/\n`);
});
