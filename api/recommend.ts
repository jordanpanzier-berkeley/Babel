import { generateRecommendations } from '../src/services/recommendationService.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { books } = req.body || {};

    if (!Array.isArray(books)) {
      return res.status(400).json({ error: 'Books must be an array.' });
    }

    const cleanBooks = books
      .map((b: any) => (typeof b === 'string' ? b.trim() : ''))
      .filter((b: string) => b.length > 0)
      .slice(0, 5);

    if (cleanBooks.length === 0) {
      return res.status(400).json({ error: 'Please enter at least 1 book title.' });
    }

    const recommendations = await generateRecommendations(
      cleanBooks,
      process.env.GEMINI_API_KEY
    );

    return res.status(200).json({ recommendations });
  } catch (err: any) {
    console.error('Vercel API error in /api/recommend:', err);
    return res.status(500).json({ error: 'Failed to generate recommendations.' });
  }
}
