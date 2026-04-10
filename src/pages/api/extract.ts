import type { APIRoute } from 'astro';
import { extractWords } from '../../lib/extractor.js';

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key non configurata sul server' }), { status: 500 });
  }

  let body: { text: string; sourceUrl: string; lang: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON non valido' }), { status: 400 });
  }

  const { text, sourceUrl, lang } = body;

  if (!text) {
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
