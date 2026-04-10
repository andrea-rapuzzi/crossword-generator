import type { APIRoute } from 'astro';
import { extractWords } from '../../lib/extractor.js';

export const POST: APIRoute = async ({ request }) => {
  let body: { text: string; sourceUrl: string; lang: string; apiKey: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON non valido' }), { status: 400 });
  }

  const { text, sourceUrl, lang, apiKey } = body;

  if (!text || !apiKey) {
    return new Response(JSON.stringify({ error: 'Parametri mancanti' }), { status: 400 });
  }

  try {
    const words = await extractWords({ text, sourceUrl, lang, apiKey });
    return new Response(JSON.stringify({ words }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Errore estrazione' }), { status: 500 });
  }
};
