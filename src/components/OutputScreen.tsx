import React, { useState } from 'react';
import { BookRecommendation } from '../types.ts';

interface OutputScreenProps {
  recommendations: BookRecommendation[];
  inputBooks: string[];
}

export const OutputScreen: React.FC<OutputScreenProps> = ({
  recommendations,
  inputBooks,
}) => {
  const activeInputTitles = inputBooks.filter((b) => b.trim());
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleImageError = (index: number) => {
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  return (
    <section className="grid-12 items-baseline">
      <h2 className="col-label display m-0 [grid-row:1]">Results</h2>
      <p className="col-main note min-w-0 [grid-row:1]">Based on {activeInputTitles.join(', ')}</p>

      <div className="pt-8">
        <ol className="results">
          {recommendations.map((book, idx) => {
            const hasError = imageErrors[idx];
            const showCover = book.coverUrl && !hasError;

            return (
              <li key={idx} className="result">
                <div className="frame">
                  {showCover ? (
                    <img
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
                      loading="lazy"
                      onError={() => handleImageError(idx)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                      <span className="micro dim line-clamp-4">{book.title}</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex flex-col gap-2 select-text">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="display !text-base" aria-hidden="true">0{idx + 1}</span>
                    <span className="micro dim text-right">{book.genre}</span>
                  </div>

                  <h3 className="display !text-xl !leading-tight m-0 [text-wrap:balance]">
                    {book.title}
                  </h3>
                  <span className="micro dim">{book.author}</span>

                  <p className="m-0 mt-1 text-base leading-normal">{book.description}</p>

                  {book.reason && (
                    <p className="m-0 text-base leading-normal why">
                      <span className="micro mr-2">Why</span>
                      {book.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
