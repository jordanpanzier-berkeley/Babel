import { GoogleGenAI, Type } from '@google/genai';
import { BookRecommendation, BookSuggestion } from '../types.ts';

// Curated backup recommendations with authentic Open Library cover images and reasons
const CURATED_FALLBACKS: Record<string, (inputSummary: string) => BookRecommendation[]> = {
  scifi: (input) => [
    {
      title: "Neuromancer",
      author: "William Gibson",
      genre: "Sci-Fi",
      description: "A washed-up computer hacker is hired for one last desperate run against an artificial intelligence. It pioneered the cyberpunk genre with vivid neo-noir atmosphere.",
      reason: `Echoes the visionary world-building and dense speculative atmosphere of ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/283860-L.jpg"
    },
    {
      title: "The Left Hand of Darkness",
      author: "Ursula K. Le Guin",
      genre: "Sci-Fi",
      description: "A human envoy navigates political intrigue on an icy world where inhabitants can change biological sex at will. A profound exploration of gender, culture, and solitude.",
      reason: `Shares ${input}'s deep sociopolitical intrigue and philosophical depth.`,
      coverUrl: "https://covers.openlibrary.org/b/id/8315250-L.jpg"
    },
    {
      title: "Solaris",
      author: "Stanisław Lem",
      genre: "Sci-Fi",
      description: "A psychologist arrives at a research station orbiting an ocean planet that materializes memories into physical form. A haunting psychological examination of human limits in the face of the unknown.",
      reason: `Matches the eerie existential mystery and cerebral pacing found in ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/10543679-L.jpg"
    },
    {
      title: "Hyperion",
      author: "Dan Simmons",
      genre: "Sci-Fi",
      description: "Seven pilgrims travel across space toward an enigmatic creature worshipped as a god of pain. Told through interconnected confessions, it balances sprawling galactic scale with deeply personal stakes.",
      reason: `Delivers the same expansive scale, complex lore, and narrative tension as ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/6652458-L.jpg"
    }
  ],
  fiction: (input) => [
    {
      title: "The Secret History",
      author: "Donna Tartt",
      genre: "Literary Fiction",
      description: "An eccentric group of classics students at an elite college cross ethical boundaries with devastating consequences. A gripping inverted mystery exploring obsession, beauty, and guilt.",
      reason: `Channels the psychological tension, moral ambiguity, and intellectual allure of ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/744854-L.jpg"
    },
    {
      title: "Never Let Me Go",
      author: "Kazuo Ishiguro",
      genre: "Literary Fiction",
      description: "Three friends grow up at an idyllic English boarding school harboring a dark purpose about their future. A tender and heartbreaking meditation on memory, mortality, and what gives life meaning.",
      reason: `Features the same understated emotional resonance and quiet foreboding as ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/11186794-L.jpg"
    },
    {
      title: "Kafka on the Shore",
      author: "Haruki Murakami",
      genre: "Magical Realism",
      description: "A teenage runaway and an elderly man with unusual abilities cross paths amid strange supernatural events. It weaves dreams, myths, and reality into a mesmerizing puzzle.",
      reason: `Explores surreal dreamlike logic and rich internal journeys similar to ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/8235105-L.jpg"
    },
    {
      title: "If on a winter's night a traveler",
      author: "Italo Calvino",
      genre: "Fiction",
      description: "A reader attempts to finish an alluring novel only to find each chapter interrupted by a completely different story. An inventive, playful ode to the sheer adventure of reading.",
      reason: `Shares ${input}'s fascination with intricate structure and immersive prose.`,
      coverUrl: "https://covers.openlibrary.org/b/id/12818862-L.jpg"
    }
  ],
  dystopian: (input) => [
    {
      title: "Fahrenheit 451",
      author: "Ray Bradbury",
      genre: "Dystopian",
      description: "In a future where printed literature is outlawed, a fireman responsible for burning books begins questioning his role. A lyrical defense of independent thought and preservation of knowledge.",
      reason: `Parallels ${input}'s focus on ideological oppression and intellectual rebellion.`,
      coverUrl: "https://covers.openlibrary.org/b/id/9255566-L.jpg"
    },
    {
      title: "Brave New World",
      author: "Aldous Huxley",
      genre: "Dystopian",
      description: "Citizens are engineered into rigid castes and kept docile through state-sanctioned conditioning and synthetic pleasure. It chillingly questions the price of total societal comfort.",
      reason: `Explores the terrifying price of conformity and social engineering seen in ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/8231823-L.jpg"
    },
    {
      title: "We",
      author: "Yevgeny Zamyatin",
      genre: "Dystopian",
      description: "A mathematician in a glass-enclosed city ruled by numbers and schedules rediscovers rebellious passion. The seminal classic that inspired modern totalitarian fiction.",
      reason: `Captures the mathematical rigidity and rising individual defiance central to ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/6513251-L.jpg"
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

export async function lookupCover(title: string, author?: string): Promise<string | undefined> {
  try {
    const query = `${title} ${author || ''}`.trim();
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const data = await res.json();
    const doc = data.docs && data.docs[0];
    if (doc && doc.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (doc && doc.isbn && doc.isbn[0]) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }
  } catch {
    // Return undefined on error/timeout
  }
  return undefined;
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

Suggest 1 to 5 similar reading recommendations.
Requirements:
1. Suggest between 3 and 5 high-quality, closely matching recommendations (or 1 to 5).
2. Do NOT suggest any of the books provided in the input list.
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
        const rawFormatted = parsed.slice(0, 5).map((item) => ({
          title: String(item.title || '').trim(),
          author: String(item.author || '').trim(),
          genre: String(item.genre || '').trim(),
          description: String(item.description || '').trim(),
          reason: String(item.reason || '').trim(),
        }));

        const formatted = await Promise.all(
          rawFormatted.map(async (book) => {
            const coverUrl = await lookupCover(book.title, book.author);
            return { ...book, coverUrl };
          })
        );

        return formatted;
      }
    } catch (apiError: any) {
      console.warn('Gemini API call timed out or failed, using smart fallback:', apiError?.message || apiError);
    }
  }

  // Fallback if no API key or error
  return getSmartFallback(cleanBooks);
}
