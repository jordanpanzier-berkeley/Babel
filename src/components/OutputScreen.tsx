import React, { useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { BookRecommendation } from '../types.ts';

interface OutputScreenProps {
  recommendations: BookRecommendation[];
  inputBooks: string[];
  onBack: () => void;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({
  recommendations,
  inputBooks,
  onBack,
}) => {
  const activeInputTitles = inputBooks.filter((b) => b.trim());
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleImageError = (index: number) => {
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 sm:p-8 md:p-10 font-condensed text-[#1C211A]">
      <div>
        {/* Section Header */}
        <div className="border-b-2 border-[#110D0C] pb-2 mb-4 flex items-baseline justify-between">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#110D0C]">
            RECOMMENDATIONS
          </h2>
          <span className="text-sm font-bold tracking-widest text-[#37784D] uppercase">
            {recommendations.length} BOOKS
          </span>
        </div>

        {/* Input Reference Summary */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs uppercase font-bold text-[#110D0C]/60">
          <span className="text-[#87B5B2] font-black">BASED ON:</span>
          {activeInputTitles.map((title, i) => (
            <span
              key={i}
              className="bg-[#110D0C]/5 px-2 py-0.5 border border-[#110D0C]/15 text-[#110D0C]"
            >
              {title}
            </span>
          ))}
        </div>

        {/* Recommendations List with Book Pictures */}
        <div className="space-y-6 overflow-y-auto max-h-[500px] pr-2">
          {recommendations.map((book, idx) => {
            const hasError = imageErrors[idx];
            const showCover = book.coverUrl && !hasError;

            return (
              <div
                key={idx}
                className="border-b-2 border-[#110D0C]/15 pb-6 last:border-b-0 flex gap-4 sm:gap-6 items-start"
              >
                {/* Book Picture / Cover */}
                <div className="w-20 sm:w-24 h-28 sm:h-34 shrink-0 bg-[#110D0C] border-2 border-[#110D0C] shadow-md overflow-hidden relative flex items-center justify-center">
                  {showCover ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      onError={() => handleImageError(idx)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-1.5 flex flex-col justify-between bg-gradient-to-b from-[#110D0C] via-[#37784D] to-[#110D0C] text-[#F4F4E8] text-center select-none">
                      <BookOpen className="w-4 h-4 mx-auto text-[#F0B907]" />
                      <span className="text-[10px] font-black uppercase leading-tight line-clamp-3">
                        {book.title}
                      </span>
                      <span className="text-[8px] uppercase tracking-wider text-[#87B5B2] line-clamp-1">
                        {book.author}
                      </span>
                    </div>
                  )}
                </div>

                {/* Book Details */}
                <div className="flex-1 min-w-0">
                  {/* Slot Number & Genre */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-black text-[#87B5B2] select-none">
                      0{idx + 1}
                    </span>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-[#37784D] bg-[#37784D]/10 px-2 py-0.5">
                      {book.genre}
                    </span>
                  </div>

                  {/* Title (Notice: NO hover color change!) */}
                  <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#110D0C] leading-tight mb-1 select-text">
                    {book.title}
                  </h3>

                  {/* Author */}
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#110D0C]/65 mb-2">
                    BY {book.author}
                  </div>

                  {/* 1-2 sentence description */}
                  <p className="text-sm sm:text-base text-[#110D0C] leading-snug tracking-tight mb-2">
                    {book.description}
                  </p>

                  {/* Succinct reason in album red (#C82D18) */}
                  {book.reason && (
                    <div className="text-xs sm:text-sm font-bold tracking-tight text-[#C82D18] flex items-start gap-1.5 leading-snug">
                      <span className="uppercase tracking-wider font-black shrink-0 text-[#C82D18]">
                        WHY:
                      </span>
                      <span>{book.reason}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exactly ONE Single Button to Return to Homepage */}
      <div className="pt-6 border-t-2 border-[#110D0C]/15">
        <button
          type="button"
          onClick={onBack}
          className="w-full py-4 px-6 text-xl sm:text-2xl font-black uppercase tracking-wider bg-[#110D0C] text-[#F4F4E8] hover:bg-[#C82D18] flex items-center justify-center gap-3 transition-colors cursor-pointer active:translate-y-0.5"
        >
          <ArrowLeft className="w-5 h-5 text-[#F0B907]" />
          <span>BACK</span>
        </button>
      </div>
    </div>
  );
};
