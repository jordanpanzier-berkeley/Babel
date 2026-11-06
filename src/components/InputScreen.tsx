import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { BookSuggestion } from '../types.ts';

interface InputScreenProps {
  books: string[];
  setBooks: React.Dispatch<React.SetStateAction<string[]>>;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string | null;
}

export const InputScreen: React.FC<InputScreenProps> = ({
  books,
  setBooks,
  onSubmit,
  isLoading,
  error,
}) => {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSlotRef = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep ref in sync for event listeners
  activeSlotRef.current = activeSlot;

  const handleBookChange = (index: number, value: string) => {
    const updated = [...books];
    updated[index] = value;
    setBooks(updated);
    setActiveSlot(index);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-books?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const selectSuggestion = (index: number, suggestion: BookSuggestion) => {
    const updated = [...books];
    updated[index] = suggestion.title;
    setBooks(updated);
    setSuggestions([]);
    setActiveSlot(null);
  };

  const closeSuggestions = () => {
    setActiveSlot(null);
    setSuggestions([]);
  };

  const addBookSlot = () => {
    if (books.length < 5) {
      const nextIndex = books.length;
      setBooks([...books, '']);
      closeSuggestions();
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
      }, 50);
    }
  };

  const removeBookSlot = (index: number) => {
    if (books.length > 1) {
      const updated = books.filter((_, i) => i !== index);
      setBooks(updated);
    } else {
      setBooks(['']);
    }
    closeSuggestions();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeSuggestions();
      if (index === books.length - 1 && books.length < 5 && books[index].trim()) {
        addBookSlot();
      } else if (hasValidBook) {
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  };

  // Close recommendations immediately when clicking outside of the active search bar
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (activeSlotRef.current === null) return;
      const currentActiveRow = rowRefs.current[activeSlotRef.current];
      if (currentActiveRow && !currentActiveRow.contains(e.target as Node)) {
        closeSuggestions();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const hasValidBook = books.some((b) => b.trim().length > 0);

  return (
    <div className="flex-1 flex flex-col justify-between p-5 sm:p-8 md:p-10 font-condensed text-[#1C211A]">
      <div>
        {/* Section Header */}
        <div className="border-b-2 border-[#110D0C] pb-2 mb-6 flex items-baseline justify-between">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#110D0C]">
            ENTER 1–5 BOOKS
          </h2>
          <span className="text-sm font-bold tracking-widest text-[#37784D] uppercase">
            {books.filter((b) => b.trim()).length} / 5
          </span>
        </div>

        {/* Inputs List with Autocomplete Dropdown */}
        <div className="space-y-4">
          {books.map((book, idx) => (
            <div
              key={idx}
              ref={(el) => { rowRefs.current[idx] = el; }}
              className="relative"
            >
              <div className="flex items-center gap-3 bg-white border-2 border-[#110D0C] focus-within:border-[#C82D18] p-2 px-3 transition-colors">
                <span className="text-base font-black text-[#87B5B2] select-none w-6">
                  0{idx + 1}
                </span>

                <input
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  value={book}
                  onChange={(e) => handleBookChange(idx, e.target.value)}
                  onFocus={() => {
                    setActiveSlot(idx);
                    if (book.trim().length >= 2) {
                      handleBookChange(idx, book);
                    }
                  }}
                  onBlur={() => {
                    // Slight delay to allow clicking a dropdown recommendation before closing
                    setTimeout(() => {
                      if (activeSlotRef.current === idx) {
                        closeSuggestions();
                      }
                    }, 180);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  placeholder="TYPE BOOK TITLE..."
                  disabled={isLoading}
                  autoFocus={idx === 0}
                  className="w-full bg-transparent text-base sm:text-lg font-bold uppercase tracking-wide text-[#110D0C] placeholder-[#110D0C]/35 focus:outline-none"
                />

                {books.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBookSlot(idx)}
                    disabled={isLoading}
                    title="Remove book slot"
                    className="p-1 text-[#110D0C]/40 hover:text-[#C82D18] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {activeSlot === idx && (suggestions.length > 0 || isSearching) && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#F4F4E8] border-2 border-[#110D0C] shadow-xl max-h-60 overflow-y-auto"
                >
                  {isSearching && suggestions.length === 0 ? (
                    <div className="p-3 text-xs uppercase tracking-wider text-[#110D0C]/60 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#87B5B2]" />
                      <span>SEARCHING TITLES...</span>
                    </div>
                  ) : (
                    suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => selectSuggestion(idx, sug)}
                        className="w-full text-left p-2.5 px-3 border-b border-[#110D0C]/10 last:border-b-0 hover:bg-[#87B5B2]/25 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {sug.coverUrl ? (
                            <img
                              src={sug.coverUrl}
                              alt=""
                              className="w-6 h-8 object-cover border border-[#110D0C]/30 shrink-0"
                            />
                          ) : (
                            <BookOpen className="w-4 h-4 text-[#87B5B2] shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-extrabold text-sm sm:text-base uppercase text-[#110D0C] block truncate">
                              {sug.title}
                            </span>
                            <span className="text-xs uppercase text-[#110D0C]/60 block truncate">
                              BY {sug.author}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs uppercase font-bold text-[#37784D] shrink-0">
                          SELECT
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Book Button (Up to 5) */}
        {books.length < 5 && (
          <button
            type="button"
            onClick={addBookSlot}
            disabled={isLoading}
            className="mt-4 flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-wider text-[#37784D] hover:text-[#110D0C] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ADD BOOK ({books.length}/5)</span>
          </button>
        )}

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-2.5 bg-[#C82D18]/10 border-l-4 border-[#C82D18] text-[#C82D18] text-sm font-bold uppercase">
            {error}
          </div>
        )}
      </div>

      {/* Single Submit Button */}
      <div className="pt-8">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasValidBook || isLoading}
          className={`w-full py-4 px-6 text-xl sm:text-2xl font-black uppercase tracking-wider flex items-center justify-center gap-3 transition-colors cursor-pointer ${
            !hasValidBook || isLoading
              ? 'bg-[#110D0C]/20 text-[#110D0C]/40 cursor-not-allowed'
              : 'bg-[#110D0C] text-[#F4F4E8] hover:bg-[#C82D18] active:translate-y-0.5'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#F0B907]" />
              <span>SEARCHING RECOMMENDATIONS...</span>
            </>
          ) : (
            <>
              <span>RECOMMEND</span>
              <ArrowRight className="w-5 h-5 text-[#F0B907]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
