import type { APIRoute } from 'astro';
import { scrapeUrl } from '../../lib/scraper.js';

export const POST: APIRoute = async ({ request }) => {
  let url: string;
  try {
    ({ url } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'JSON non valido' }), { status: 400 });
  }

  if (!url || !/^https?:\/\/.+/.test(url)) {
    return new Response(JSON.stringify({ error: 'URL non valida' }), { status: 400 });
  }

  try {
    const result = await scrapeUrl(url);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Errore scraping' }), { status: 500 });
  }
};
