/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InputScreen } from './components/InputScreen.tsx';
import { OutputScreen } from './components/OutputScreen.tsx';
import { BookRecommendation, RecommendationResponse } from './types.ts';

export default function App() {
  const [screen, setScreen] = useState<'input' | 'output'>('input');
  const [books, setBooks] = useState<string[]>(['', '', '']);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const validBooks = books.map((b) => b.trim()).filter((b) => b.length > 0);

    if (validBooks.length === 0) {
      setError('PLEASE ENTER AT LEAST 1 BOOK TITLE');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ books: validBooks }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'FAILED TO FETCH RECOMMENDATIONS');
      }

      const data: RecommendationResponse = await res.json();

      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations);
        setScreen('output');
      } else {
        throw new Error('NO RECOMMENDATIONS FOUND. PLEASE TRY DIFFERENT TITLES.');
      }
    } catch (err: any) {
      setError(err?.message || 'AN ERROR OCCURRED. PLEASE TRY AGAIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    setScreen('input');
  };

  return (
    <div className="min-h-screen w-full bg-[#110D0C] flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4 md:p-8 font-condensed">
      <div className="w-full max-w-2xl bg-[#F4F4E8] border-2 border-[#110D0C] shadow-2xl flex flex-col overflow-hidden">
        {/* Clean Header: "Babel" and "Reading Recommendations", same heading font */}
        <header className="bg-[#110D0C] px-6 py-4 border-b-2 border-[#110D0C] flex items-baseline gap-3">
          <span className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#F4F4E8] select-none font-condensed">
            Babel
          </span>
          <span className="text-sm sm:text-base font-bold uppercase tracking-widest text-[#87B5B2] font-condensed">
            Reading Recommendations
          </span>
        </header>

        {/* Main Interface (Clean cream paper, no watermarks) */}
        <main className="flex-1 bg-[#F4F4E8] flex flex-col min-h-[500px]">
          {/* Screen 1: Input Screen */}
          {screen === 'input' && (
            <InputScreen
              books={books}
              setBooks={setBooks}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              error={error}
            />
          )}

          {/* Screen 2: Output Screen */}
          {screen === 'output' && (
            <OutputScreen
              recommendations={recommendations}
              inputBooks={books}
              onBack={handleBack}
            />
          )}
        </main>
      </div>
    </div>
  );
}
