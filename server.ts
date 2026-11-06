import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BookRecommendation {
  title: string;
  author: string;
  genre: string;
  description: string;
  reason: string;
  coverUrl?: string;
}

// Curated backup recommendations with authentic Open Library cover images and reasons
const CURATED_FALLBACKS: Record<string, (inputSummary: string) => BookRecommendation[]> = {
  scifi: (input) => [
    {
      title: "Neuromancer",
      author: "William Gibson",
      genre: "Sci-Fi",
      description: "A washed-up computer hacker is hired for one last desperate run against an artificial intelligence. It pioneered the cyberpunk genre with vivid neo-noir atmosphere.",
      reason: `Echoes the visionary world-building and dense speculative atmosphere of ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/283860-M.jpg"
    },
    {
      title: "The Left Hand of Darkness",
      author: "Ursula K. Le Guin",
      genre: "Sci-Fi",
      description: "A human envoy navigates political intrigue on an icy world where inhabitants can change biological sex at will. A profound exploration of gender, culture, and solitude.",
      reason: `Shares ${input}'s deep sociopolitical intrigue and philosophical depth.`,
      coverUrl: "https://covers.openlibrary.org/b/id/8315250-M.jpg"
    },
    {
      title: "Solaris",
      author: "Stanisław Lem",
      genre: "Sci-Fi",
      description: "A psychologist arrives at a research station orbiting an ocean planet that materializes memories into physical form. A haunting psychological examination of human limits in the face of the unknown.",
      reason: `Matches the eerie existential mystery and cerebral pacing found in ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/10543679-M.jpg"
    },
    {
      title: "Hyperion",
      author: "Dan Simmons",
      genre: "Sci-Fi",
      description: "Seven pilgrims travel across space toward an enigmatic creature worshipped as a god of pain. Told through interconnected confessions, it balances sprawling galactic scale with deeply personal stakes.",
      reason: `Delivers the same expansive scale, complex lore, and narrative tension as ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/6652458-M.jpg"
    }
  ],
  fiction: (input) => [
    {
      title: "The Secret History",
      author: "Donna Tartt",
      genre: "Literary Fiction",
      description: "An eccentric group of classics students at an elite college cross ethical boundaries with devastating consequences. A gripping inverted mystery exploring obsession, beauty, and guilt.",
      reason: `Channels the psychological tension, moral ambiguity, and intellectual allure of ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/744854-M.jpg"
    },
    {
      title: "Never Let Me Go",
      author: "Kazuo Ishiguro",
      genre: "Literary Fiction",
      description: "Three friends grow up at an idyllic English boarding school harboring a dark purpose about their future. A tender and heartbreaking meditation on memory, mortality, and what gives life meaning.",
      reason: `Features the same understated emotional resonance and quiet foreboding as ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/11186794-M.jpg"
    },
    {
      title: "Kafka on the Shore",
      author: "Haruki Murakami",
      genre: "Magical Realism",
      description: "A teenage runaway and an elderly man with unusual abilities cross paths amid strange supernatural events. It weaves dreams, myths, and reality into a mesmerizing puzzle.",
      reason: `Explores surreal dreamlike logic and rich internal journeys similar to ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/8235105-M.jpg"
    },
    {
      title: "If on a winter's night a traveler",
      author: "Italo Calvino",
      genre: "Fiction",
      description: "A reader attempts to finish an alluring novel only to find each chapter interrupted by a completely different story. An inventive, playful ode to the sheer adventure of reading.",
      reason: `Shares ${input}'s fascination with intricate structure and immersive prose.`,
      coverUrl: "https://covers.openlibrary.org/b/id/12818862-M.jpg"
    }
  ],
  dystopian: (input) => [
    {
      title: "Fahrenheit 451",
      author: "Ray Bradbury",
      genre: "Dystopian",
      description: "In a future where printed literature is outlawed, a fireman responsible for burning books begins questioning his role. A lyrical defense of independent thought and preservation of knowledge.",
      reason: `Parallels ${input}'s focus on ideological oppression and intellectual rebellion.`,
      coverUrl: "https://covers.openlibrary.org/b/id/9255566-M.jpg"
    },
    {
      title: "Brave New World",
      author: "Aldous Huxley",
      genre: "Dystopian",
      description: "Citizens are engineered into rigid castes and kept docile through state-sanctioned conditioning and synthetic pleasure. It chillingly questions the price of total societal comfort.",
      reason: `Explores the terrifying price of conformity and social engineering seen in ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/8231823-M.jpg"
    },
    {
      title: "We",
      author: "Yevgeny Zamyatin",
      genre: "Dystopian",
      description: "A mathematician in a glass-enclosed city ruled by numbers and schedules rediscovers rebellious passion. The seminal classic that inspired modern totalitarian fiction.",
      reason: `Captures the mathematical rigidity and rising individual defiance central to ${input}.`,
      coverUrl: "https://covers.openlibrary.org/b/id/6513251-M.jpg"
    }
  ]
};

function getSmartFallback(books: string[]): BookRecommendation[] {
  const combined = books.join(' ').toLowerCase();
  const inputSummary = books.slice(0, 2).join(' and ');
  if (combined.includes('dune') || combined.includes('neuromancer') || combined.includes('space') || combined.includes('mars') || combined.includes('robot') || combined.includes('cyber') || combined.includes('foundation')) {
    return CURATED_FALLBACKS.scifi(inputSummary);
  }
  if (combined.includes('1984') || combined.includes('brave') || combined.includes('handmaid') || combined.includes('fahrenheit')) {
    return CURATED_FALLBACKS.dystopian(inputSummary);
  }
  return CURATED_FALLBACKS.fiction(inputSummary);
}

// Helper to look up cover pictures via Open Library
async function lookupCover(title: string, author?: string): Promise<string | undefined> {
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
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
    }
    if (doc && doc.isbn && doc.isbn[0]) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
    }
  } catch {
    // If cover lookup times out or fails, return undefined
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const portArg = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : null;
  const PORT = portArg || Number(process.env.DEFAULT_APP_PORT) || 3000;

  app.use(express.json());

  // Autocomplete book search endpoint
  app.get('/api/search-books', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) {
        return res.json({ suggestions: [] });
      }

      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const openLibRes = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!openLibRes.ok) {
        return res.json({ suggestions: [] });
      }

      const data = await openLibRes.json();
      const docs = data.docs || [];

      const suggestions = docs.slice(0, 6).map((doc: any) => ({
        title: String(doc.title || '').trim(),
        author: doc.author_name && doc.author_name.length > 0 ? doc.author_name[0] : 'Unknown',
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg` : undefined,
      }));

      return res.json({ suggestions });
    } catch (err: any) {
      return res.json({ suggestions: [] });
    }
  });

  // Recommendation API endpoint
  app.post('/api/recommend', async (req, res) => {
    try {
      const { books } = req.body;

      if (!Array.isArray(books)) {
        return res.status(400).json({ error: 'Books must be an array.' });
      }

      const cleanBooks = books
        .map((b) => (typeof b === 'string' ? b.trim() : ''))
        .filter((b) => b.length > 0)
        .slice(0, 5);

      if (cleanBooks.length === 0) {
        return res.status(400).json({ error: 'Please enter at least 1 book title.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;

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

            // Concurrently look up covers for each recommended book
            const formatted: BookRecommendation[] = await Promise.all(
              rawFormatted.map(async (book) => {
                const coverUrl = await lookupCover(book.title, book.author);
                return { ...book, coverUrl };
              })
            );

            return res.json({ recommendations: formatted });
          }
        } catch (apiError: any) {
          console.warn('Gemini API call timed out or failed, using smart fallback:', apiError?.message || apiError);
          const fallback = getSmartFallback(cleanBooks);
          return res.json({ recommendations: fallback });
        }
      }

      // If no API key configured, use curated smart fallback
      const fallback = getSmartFallback(cleanBooks);
      return res.json({ recommendations: fallback });
    } catch (err: any) {
      console.error('Server error handling /api/recommend:', err);
      return res.status(500).json({ error: 'Unable to generate recommendations. Please try again.' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Babel' });
  });

  // Serve frontend with Vite middlewares in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Babel server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
