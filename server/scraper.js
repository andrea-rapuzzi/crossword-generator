import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const MAX_TEXT_LENGTH = 5000;

// Tags whose content we strip entirely
const STRIP_TAGS = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe', 'form'];

// Tags whose text content we keep
const KEEP_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'blockquote', 'figcaption'];

export async function scrapeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let html;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FDLCrosswordBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);

  // Remove noise tags
  STRIP_TAGS.forEach(tag => $(tag).remove());

  // Extract title
  const title = $('title').text().trim() || $('h1').first().text().trim() || '';

  // Extract clean text from meaningful tags
  const parts = [];
  KEEP_TAGS.forEach(tag => {
    $(tag).each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 20) parts.push(t);
    });
  });

  // Deduplicate consecutive duplicates and truncate
  const seen = new Set();
  const unique = parts.filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  const text = unique.join('\n').slice(0, MAX_TEXT_LENGTH);

  return { url, title, text };
}
