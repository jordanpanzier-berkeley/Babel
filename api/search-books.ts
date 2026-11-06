import { searchBooks } from '../src/services/recommendationService.ts';

export default async function handler(req: any, res: any) {
  try {
    const q = String(req.query?.q || '').trim();
    const suggestions = await searchBooks(q);
    return res.status(200).json({ suggestions });
  } catch {
    return res.status(200).json({ suggestions: [] });
  }
}
