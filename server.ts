import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  generateRecommendations,
  searchBooks,
} from './src/services/recommendationService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const suggestions = await searchBooks(q);
      return res.json({ suggestions });
    } catch {
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

      const recommendations = await generateRecommendations(
        cleanBooks,
        process.env.GEMINI_API_KEY
      );

      return res.json({ recommendations });
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
