export interface BookRecommendation {
  title: string;
  author: string;
  genre: string;
  description: string;
  reason: string;
  coverUrl?: string;
}

export interface BookSuggestion {
  title: string;
  author: string;
  coverUrl?: string;
}

export interface RecommendationResponse {
  recommendations: BookRecommendation[];
  error?: string;
}
