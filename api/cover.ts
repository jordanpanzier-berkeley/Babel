import { lookupCover } from '../src/services/recommendationService.ts';

// Best cover for one picked book (Google Books, then Open Library)
export default async function handler(req: any, res: any) {
  try {
    const title = String(req.query?.title || '').trim();
    const author = String(req.query?.author || '').trim();
    if (!title) return res.status(200).json({ coverUrl: null });
    const coverUrl = await lookupCover(title, author && author !== 'Unknown' ? author : undefined);
    return res.status(200).json({ coverUrl: coverUrl ?? null });
  } catch {
    return res.status(200).json({ coverUrl: null });
  }
}
