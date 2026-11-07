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

/** True when any listed author contains the requested author's last name. */
function authorMatches(requested: string, listed: string[] = []): boolean {
  const parts = normalizeName(requested).split(' ').filter(Boolean);
  const lastName = parts[parts.length - 1];
  if (!lastName) return true;
  return listed.some((a) => normalizeName(a).split(' ').includes(lastName));
}

/**
 * Find a cover only for a confirmed match: same title and same author.
 * Among matches, prefer the most widely published edition (usually the familiar cover).
 * Returns undefined when nothing matches, so the page shows a plain title tile instead.
 */
export async function lookupCover(title: string, author?: string): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      title,
      limit: '10',
      fields: 'title,author_name,cover_i,edition_count',
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
        doc.cover_i &&
        normalizeTitle(String(doc.title || '')) === wanted &&
        (!author || authorMatches(author, doc.author_name))
    );
    if (matches.length === 0) return undefined;

    matches.sort((a: any, b: any) => (b.edition_count || 0) - (a.edition_count || 0));
    return `https://covers.openlibrary.org/b/id/${matches[0].cover_i}-L.jpg`;
  } catch {
    // Network error or timeout: no cover rather than a wrong one
    return undefined;
  }
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

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanQ)}&limit=6`;
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
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
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

      const prompt = `Based on these ${cleanBooks.length} user-provided favorite book(s):
${cleanBooks.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Suggest 6 similar reading recommendations.
Requirements:
1. Suggest 6 high-quality, closely matching recommendations.
2. Do NOT suggest any of the books provided in the input list, under any title or edition.
3. For each book, provide:
   - title: exact book title
   - author: author name
   - genre: as simple as possible (e.g. Fiction, Sci-Fi, Memoir, Thriller, Dystopian, Fantasy)
   - description: strictly 1 to 2 sentences summarizing what makes it compelling without spoiling anything.
   - reason: a succinct 1-sentence reason why this is recommended specifically based on the user's input book(s).`;

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
