const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const PROMPTS = {
  it: `Sei un esperto di cruciverba gastronomici italiani.
Dato il seguente testo estratto da un articolo food/ricette/ristoranti, estrai 6-10 parole adatte a un cruciverba.

Regole per le parole:
- Solo parole singole o composti senza spazi (es: CARBONARA, SALTIMBOCCA)
- Solo lettere A-Z maiuscole, niente accenti o caratteri speciali
- Lunghezza minima 4 lettere, massima 15
- Preferisci termini gastronomici specifici, ingredienti, tecniche, piatti, chef famosi
- Evita parole troppo generiche come CIBO, BUONO, FATTO

Per ogni parola fornisci:
- answer: la parola in maiuscolo
- clue: un indizio breve e preciso in italiano (max 10 parole), stile cruciverba classico
- hint: una frase di suggerimento più descrittiva (max 15 parole)

Rispondi SOLO con un array JSON valido, nessun testo aggiuntivo:
[{"answer":"...","clue":"...","hint":"..."}]`,

  en: `You are an expert in food crossword puzzles.
Given the following text extracted from a food/recipe/restaurant article, extract 6-10 words suitable for a crossword puzzle.

Rules for words:
- Single words only, no spaces (e.g. CARBONARA, RISOTTO)
- Only uppercase A-Z letters, no accents or special characters
- Minimum length 4 letters, maximum 15
- Prefer specific gastronomic terms: ingredients, techniques, dishes, famous chefs
- Avoid generic words like FOOD, GOOD, MADE

For each word provide:
- answer: the word in uppercase
- clue: a short precise clue in English (max 10 words), classic crossword style
- hint: a more descriptive hint sentence (max 15 words)

Respond ONLY with a valid JSON array, no additional text:
[{"answer":"...","clue":"...","hint":"..."}]`,
};

export async function extractWords({ text, sourceUrl, lang, apiKey }) {
  const systemPrompt = PROMPTS[lang] || PROMPTS.it;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nTESTO:\n${text.slice(0, 4000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API error ${response.status}: ${err.error?.message || 'unknown'}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text?.trim() || '[]';

  let words;
  try {
    words = JSON.parse(raw);
  } catch {
    // Try to extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Claude non ha restituito JSON valido');
    words = JSON.parse(match[0]);
  }

  // Validate and sanitize
  return words
    .filter(w => w.answer && /^[A-Z]{4,15}$/.test(w.answer))
    .map(w => ({
      answer: w.answer,
      clue: w.clue || '',
      hint: w.hint || '',
      sourceUrl: sourceUrl || '',
    }));
}
