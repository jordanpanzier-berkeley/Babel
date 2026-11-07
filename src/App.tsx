/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { InputScreen } from './components/InputScreen.tsx';
import { OutputScreen } from './components/OutputScreen.tsx';
import { ButtonLabel } from './components/ButtonLabel.tsx';
import { BookRecommendation, BookSuggestion, RecommendationResponse } from './types.ts';

export default function App() {
  const [screen, setScreen] = useState<'input' | 'output'>('input');
  // Books the user has locked in by picking a search suggestion (max 5)
  const [picks, setPicks] = useState<BookSuggestion[]>([]);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After visiting results, coming home shouldn't jump into the first field
  const [hasReturned, setHasReturned] = useState(false);

  const handleSubmit = async () => {
    if (picks.length === 0) {
      setError('Pick a book first.');
      return;
    }

    // "Title by Author" is more precise for the recommender than a bare title
    const validBooks = picks.map((p) => (p.author && p.author !== 'Unknown' ? `${p.title} by ${p.author}` : p.title));

    setIsLoading(true);
    setError(null);

    try {
      let res: Response;
      try {
        res = await fetch('/api/recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ books: validBooks }),
        });
      } catch {
        throw new Error("Can't connect. Check your internet.");
      }

      if (!res.ok) {
        throw new Error("Couldn't get recommendations.");
      }

      const data: RecommendationResponse = await res.json();

      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations);
        setScreen('output');
        window.scrollTo(0, 0);
      } else {
        throw new Error('No matches. Try other titles.');
      }
    } catch (err: any) {
      setError(err?.message || "Couldn't get recommendations.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setHasReturned(true);
    setError(null);
    setScreen('input');
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-svh flex flex-col">
      <main className={`flex-1 page ${screen === 'input' ? 'page--center' : ''}`}>
        {screen === 'input' && (
          <InputScreen
            picks={picks}
            setPicks={setPicks}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
            autoFocusFirst={!hasReturned}
          />
        )}

        {screen === 'output' && (
          <OutputScreen recommendations={recommendations} inputBooks={picks.map((p) => p.title)} />
        )}
      </main>

      {screen === 'output' && (
        <button
          type="button"
          onClick={handleBack}
          className="chip chip-lg display float-bottom"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
          <ButtonLabel text="Back" />
        </button>
      )}
    </div>
  );
}
