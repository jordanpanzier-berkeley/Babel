import { GoogleGenAI, Type } from '@google/genai';
import { BookRecommendation, BookSuggestion } from '../types.ts';

// Curated backup recommendations; covers are looked up live like Gemini results
const CURATED_FALLBACKS: Record<string, (inputSummary: string) => BookRecommendation[]> = {
  scifi: (input) => [
    {
      title: "Neuromancer",
      author: "William Gibson",
      genre: "Sci-Fi",
      description: "A washed-up computer hacker is hired for one last desperate run against an artificial intelligence. It pioneered the cyberpunk genre with vivid neo-noir atmosphere.",
      reason: `Echoes the visionary world-building and dense speculative atmosphere of ${input}.`
    },
    {
      title: "The Left Hand of Darkness",
      author: "Ursula K. Le Guin",
      genre: "Sci-Fi",
      description: "A human envoy navigates political intrigue on an icy world where inhabitants can change biological sex at will. A profound exploration of gender, culture, and solitude.",
      reason: `Shares ${input}'s deep sociopolitical intrigue and philosophical depth.`
    },
    {
      title: "Solaris",
      author: "Stanisław Lem",
      genre: "Sci-Fi",
      description: "A psychologist arrives at a research station orbiting an ocean planet that materializes memories into physical form. A haunting psychological examination of human limits in the face of the unknown.",
      reason: `Matches the eerie existential mystery and cerebral pacing found in ${input}.`
    },
    {
      title: "Hyperion",
      author: "Dan Simmons",
      genre: "Sci-Fi",
      description: "Seven pilgrims travel across space toward an enigmatic creature worshipped as a god of pain. Told through interconnected confessions, it balances sprawling galactic scale with deeply personal stakes.",
      reason: `Delivers the same expansive scale, complex lore, and narrative tension as ${input}.`
    }
  ],
  fiction: (input) => [
    {
      title: "The Secret History",
      author: "Donna Tartt",
      genre: "Literary Fiction",
      description: "An eccentric group of classics students at an elite college cross ethical boundaries with devastating consequences. A gripping inverted mystery exploring obsession, beauty, and guilt.",
      reason: `Channels the psychological tension, moral ambiguity, and intellectual allure of ${input}.`
    },
    {
      title: "Never Let Me Go",
      author: "Kazuo Ishiguro",
      genre: "Literary Fiction",
      description: "Three friends grow up at an idyllic English boarding school harboring a dark purpose about their future. A tender and heartbreaking meditation on memory, mortality, and what gives life meaning.",
      reason: `Features the same understated emotional resonance and quiet foreboding as ${input}.`
    },
    {
      title: "Kafka on the Shore",
      author: "Haruki Murakami",
      genre: "Magical Realism",
      description: "A teenage runaway and an elderly man with unusual abilities cross paths amid strange supernatural events. It weaves dreams, myths, and reality into a mesmerizing puzzle.",
      reason: `Explores surreal dreamlike logic and rich internal journeys similar to ${input}.`
    },
    {
      title: "If on a winter's night a traveler",
      author: "Italo Calvino",
      genre: "Fiction",
      description: "A reader attempts to finish an alluring novel only to find each chapter interrupted by a completely different story. An inventive, playful ode to the sheer adventure of reading.",
      reason: `Shares ${input}'s fascination with intricate structure and immersive prose.`
    }
  ],
  dystopian: (input) => [
    {
      title: "Fahrenheit 451",
      author: "Ray Bradbury",
      genre: "Dystopian",
      description: "In a future where printed literature is outlawed, a fireman responsible for burning books begins questioning his role. A lyrical defense of independent thought and preservation of knowledge.",
      reason: `Parallels ${input}'s focus on ideological oppression and intellectual rebellion.`
    },
    {
      title: "Brave New World",
      author: "Aldous Huxley",
      genre: "Dystopian",
      description: "Citizens are engineered into rigid castes and kept docile through state-sanctioned conditioning and synthetic pleasure. It chillingly questions the price of total societal comfort.",
      reason: `Explores the terrifying price of conformity and social engineering seen in ${input}.`
    },
    {
      title: "We",
      author: "Yevgeny Zamyatin",
      genre: "Dystopian",
      description: "A mathematician in a glass-enclosed city ruled by numbers and schedules rediscovers rebellious passion. The seminal classic that inspired modern totalitarian fiction.",
      reason: `Captures the mathematical rigidity and rising individual defiance central to ${input}.`
    }
  ]
};

export function getSmartFallback(books: string[]): BookRecommendation[] {
  const combined = books.join(' ').toLowerCase();
  // Inputs may arrive as "Title by Author"; the canned reasons read better with titles only
  const titles = books.map((b) => b.replace(/\s+by\s+.+$/i, '').trim());
  const inputSummary = titles.slice(0, 2).join(' and ');
  if (combined.includes('dune') || combined.includes('neuromancer') || combined.includes('space') || combined.includes('mars') || combined.includes('robot') || combined.includes('cyber') || combined.includes('foundation')) {
    return CURATED_FALLBACKS.scifi(inputSummary);
  }
  if (combined.includes('1984') || combined.includes('brave') || combined.includes('handmaid') || combined.includes('fahrenheit')) {
    return CURATED_FALLBACKS.dystopian(inputSummary);
  }
  return CURATED_FALLBACKS.fiction(inputSummary);
}

/** Letters that don't split into a base letter + accent (ł, ø, æ…) mapped to plain Latin. */
const SPECIAL_LETTERS: Record<string, string> = { ł: 'l', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', þ: 'th' };

function toPlainLatin(text: string): string {
  return text
    .toLowerCase()
    .replace(/[łøæœßđþ]/g, (ch) => SPECIAL_LETTERS[ch])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Lowercase, strip accents, subtitles, a leading article and punctuation. */
export function normalizeTitle(title: string): string {
  return toPlainLatin(title)
    .split(/[:(]/)[0]
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeName(name: string): string {
  return toPlainLatin(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * True when a listed author has the requested author's last name and, when both names have one,
 * the same first initial (so "Frank Herbert" doesn't match "Brian Herbert").
 */
function authorMatches(requested: string, listed: string[] = []): boolean {
  const parts = normalizeName(requested).split(' ').filter(Boolean);
  const lastName = parts[parts.length - 1];
  if (!lastName) return true;
  const initial = parts.length > 1 ? parts[0][0] : '';
  return listed.some((a) => {
    const other = normalizeName(a).split(' ').filter(Boolean);
    if (!other.includes(lastName)) return false;
    const otherInitial = other.length > 1 ? other[0][0] : '';
    return !initial || !otherInitial || initial === otherInitial;
  });
}

// Ask Open Library for each work's best English edition alongside the work itself.
// (It only returns the edition when the key fields are requested too.)
const SEARCH_FIELDS =
  'key,title,author_name,cover_i,edition_count,editions,editions.key,editions.language,editions.cover_i';

/**
 * A work's default cover can be any language's edition (e.g. a Spanish "Never Let Me Go").
 * Prefer the English edition's cover; fall back to the work's default cover.
 */
function coverIdFor(doc: any): number | undefined {
  const english = (doc.editions?.docs ?? []).find(
    (e: any) => e.cover_i && (e.language ?? []).includes('eng')
  );
  return english?.cover_i ?? doc.cover_i ?? undefined;
}

/**
 * Find a cover only for a confirmed match: same title and same author.
 * Among matches, prefer the most widely published work, then its English edition's cover.
 * Returns undefined when nothing matches, so the page shows a plain title tile instead.
 */
async function openLibraryCover(title: string, author?: string): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      title,
      limit: '10',
      lang: 'en',
      fields: SEARCH_FIELDS,
    });
    if (author) params.set('author', author);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;

    const data = await res.json();
    const wanted = normalizeTitle(title);
    const matches = (data.docs || []).filter(
      (doc: any) =>
        coverIdFor(doc) &&
        normalizeTitle(String(doc.title || '')) === wanted &&
        (!author || authorMatches(author, doc.author_name))
    );
    if (matches.length === 0) return undefined;

    matches.sort((a: any, b: any) => (b.edition_count || 0) - (a.edition_count || 0));
    return `https://covers.openlibrary.org/b/id/${coverIdFor(matches[0])}-L.jpg`;
  } catch {
    // Network error or timeout: no cover rather than a wrong one
    return undefined;
  }
}

// Movie/TV editions usually carry a film poster; skip them when choosing a cover
const TIE_IN = /tie-?in|major motion picture|now a (?:major )?(?:film|movie|motion picture|netflix|hbo|tv|television)|soon to be a|netflix|hbo max|apple tv|hulu|prime video|tv series|television series/i;

/** Year from Google's publishedDate ("1965", "1965-08", "2021-10-12"); undated editions sort last. */
function publishedYear(v: any): number {
  const year = parseInt(String(v.publishedDate || '').slice(0, 4), 10);
  return Number.isFinite(year) ? year : Infinity;
}

/**
 * Choose the most "classic" Google Books edition for a confirmed title + author:
 * skip movie/TV tie-ins, keep English editions when any exist, then take the oldest edition with an image.
 */
export function pickClassicVolume(volumes: any[], title: string, author?: string): any | undefined {
  const wanted = normalizeTitle(title);
  const matches = volumes.filter(
    (v) =>
      v.imageLinks?.thumbnail &&
      normalizeTitle(String(v.title || '')) === wanted &&
      (!author || authorMatches(author, v.authors)) &&
      !TIE_IN.test(`${v.title ?? ''} ${v.subtitle ?? ''} ${v.description ?? ''}`)
  );
  const english = matches.filter((v) => v.language === 'en');
  const pool = english.length ? english : matches;
  // Oldest first; equal years keep Google's relevance order (sort is stable)
  return [...pool].sort((a, b) => publishedYear(a) - publishedYear(b))[0];
}

/**
 * Publisher-quality cover from Google Books, only for a confirmed title + author match.
 * Needs GOOGLE_BOOKS_API_KEY (server-side only). Without it, or on any error, returns undefined.
 */
async function googleBooksCover(title: string, author?: string): Promise<string | undefined> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return undefined;
  try {
    const lastName = author ? normalizeName(author).split(' ').pop() : '';
    const params = new URLSearchParams({
      q: `intitle:"${title}"` + (lastName ? ` inauthor:"${lastName}"` : ''),
      maxResults: '40', // more editions to choose an older, non-movie one from
      printType: 'books',
      fields: 'items(volumeInfo(title,subtitle,description,authors,language,publishedDate,imageLinks/thumbnail))',
      key,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;

    const volumes = ((await res.json()).items ?? []).map((item: any) => item.volumeInfo ?? {});
    const best = pickClassicVolume(volumes, title, author);
    if (!best) return undefined;
    return String(best.imageLinks.thumbnail)
      .replace(/^http:/, 'https:')
      .replace('&edge=curl', '')
      .concat('&fife=w400-h600'); // larger image than the default 128px thumbnail
  } catch {
    return undefined;
  }
}

// Remember covers already found so repeat books don't use up the daily lookup limit.
// Misses aren't remembered, so a brief network error doesn't stick.
const coverCache = new Map<string, string>();

/** Cover for a book: Google Books first, then Open Library; undefined means show the title tile. */
export async function lookupCover(title: string, author?: string): Promise<string | undefined> {
  const cacheKey = `${normalizeTitle(title)}|${author ? normalizeName(author) : ''}`;
  const cached = coverCache.get(cacheKey);
  if (cached) return cached;
  const cover = (await googleBooksCover(title, author)) ?? (await openLibraryCover(title, author));
  if (cover) coverCache.set(cacheKey, cover);
  return cover;
}

/** Split "Title by Author" (how the app sends picks) into its parts. */
function parseInput(input: string): { title: string; author?: string } {
  const m = input.match(/^(.*?)\s+by\s+(.+)$/i);
  return m ? { title: m[1].trim(), author: m[2].trim() } : { title: input.trim() };
}

/** True when a recommendation is one of the books the user entered. */
function isInputBook(rec: { title: string; author: string }, inputs: string[]): boolean {
  const recTitle = normalizeTitle(rec.title);
  return inputs.some((raw) => {
    const input = parseInput(raw);
    if (normalizeTitle(input.title) !== recTitle) return false;
    // Same title: treat as the same book unless both authors are known and differ
    return !input.author || !rec.author || authorMatches(input.author, [rec.author]);
  });
}

export async function searchBooks(query: string): Promise<BookSuggestion[]> {
  const cleanQ = query.trim();
  if (cleanQ.length < 2) return [];

  // Suggestions are text only (covers come from /api/cover after a pick)
  const params = new URLSearchParams({ q: cleanQ, limit: '6', fields: 'title,author_name' });
  const url = `https://openlibrary.org/search.json?${params}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) return [];
  const data = await res.json();
  const docs = data.docs || [];

  return docs.slice(0, 6).map((doc: any) => ({
    title: String(doc.title || '').trim(),
    author: doc.author_name && doc.author_name.length > 0 ? doc.author_name[0] : 'Unknown',
  }));
}

export async function generateRecommendations(
  cleanBooks: string[],
  apiKey?: string
): Promise<BookRecommendation[]> {
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // With 2+ favorites, favor books that connect several of them and list those first
      const overlapRule =
        cleanBooks.length > 1
          ? `
3. Strongly prefer books that share qualities with SEVERAL of the input books over books that resemble only one.
   Order the list so books that connect to the most input books come first; books matching a single input go last.`
          : '';

      const prompt = `Based on these ${cleanBooks.length} user-provided favorite book(s):
${cleanBooks.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Suggest 6 similar reading recommendations.
Requirements:
1. Suggest 6 high-quality, closely matching recommendations.
2. Do NOT suggest any of the books provided in the input list, under any title or edition.${overlapRule}
${cleanBooks.length > 1 ? '4' : '3'}. For each book, provide:
   - title: exact book title
   - author: author name
   - genre: as simple as possible (e.g. Fiction, Sci-Fi, Memoir, Thriller, Dystopian, Fantasy)
   - description: strictly 1 to 2 sentences summarizing what makes it compelling without spoiling anything.
   - reason: a succinct 1-sentence reason why this is recommended specifically based on the user's input book(s); when it connects to several of them, name them.`;

      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction:
            'You are Babel, a reading recommendation engine. Your task is to recommend high-quality books based strictly on 1 to 5 input titles. Output only clean, concise recommendations with simple genre, a 1-2 sentence spoiler-free description, and a succinct 1-sentence reason why it is recommended based on the user\'s input.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                genre: { type: Type.STRING },
                description: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['title', 'author', 'genre', 'description', 'reason'],
            },
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 8000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = (response as any)?.text ?? '[]';
      const parsed = JSON.parse(rawText.trim());

      if (Array.isArray(parsed) && parsed.length > 0) {
        const fromGemini = parsed.map((item) => ({
          title: String(item.title || '').trim(),
          author: String(item.author || '').trim(),
          genre: String(item.genre || '').trim(),
          description: String(item.description || '').trim(),
          reason: String(item.reason || '').trim(),
        }));
        const kept = fromGemini.filter((b) => b.title && !isInputBook(b, cleanBooks));
        if (kept.length > 0) {
          return withCovers(kept.slice(0, 5));
        }
      }
    } catch (apiError: any) {
      console.warn('Gemini API call timed out or failed, using smart fallback:', apiError?.message || apiError);
    }
  }

  // Fallback if no API key or error; never return the user's own books
  const fallback = getSmartFallback(cleanBooks).filter((b) => !isInputBook(b, cleanBooks));
  return withCovers(fallback.slice(0, 5));
}

/** Attach a verified cover to each book (in parallel). */
async function withCovers(books: BookRecommendation[]): Promise<BookRecommendation[]> {
  return Promise.all(
    books.map(async (book) => ({ ...book, coverUrl: await lookupCover(book.title, book.author) }))
  );
}
