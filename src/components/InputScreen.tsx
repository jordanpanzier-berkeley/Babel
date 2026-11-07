import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { BookSuggestion } from '../types.ts';
import { ButtonLabel } from './ButtonLabel.tsx';

const MAX_PICKS = 5;

interface InputScreenProps {
  picks: BookSuggestion[];
  setPicks: React.Dispatch<React.SetStateAction<BookSuggestion[]>>;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string | null;
  /** Focus the search on load (off when returning from results) */
  autoFocusFirst?: boolean;
}

const sameBook = (a: BookSuggestion, b: BookSuggestion) =>
  a.title.toLowerCase() === b.title.toLowerCase() && a.author.toLowerCase() === b.author.toLowerCase();

export const InputScreen: React.FC<InputScreenProps> = ({
  picks,
  setPicks,
  onSubmit,
  isLoading,
  error,
  autoFocusFirst = true,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // a search finished for the current text
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coverErrors, setCoverErrors] = useState<Record<string, boolean>>({});

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isFull = picks.length >= MAX_PICKS;
  const hasPicks = picks.length > 0;

  const closeMenu = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const runSearch = (value: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = value.trim();
    setHasSearched(false);
    if (trimmed.length < 2) {
      requestIdRef.current++;
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const requestId = ++requestIdRef.current;
    debounceTimerRef.current = setTimeout(async () => {
      let results: BookSuggestion[] = [];
      try {
        const res = await fetch(`/api/search-books?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          results = data.suggestions || [];
        }
      } catch {
        results = [];
      }
      // Ignore answers to older searches
      if (requestId !== requestIdRef.current) return;
      setSuggestions(results);
      setActiveIndex(-1);
      setIsSearching(false);
      setHasSearched(true);
    }, 250);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    runSearch(value);
  };

  // Swap in the best available cover (Google Books first) once the server finds it
  const upgradeCover = async (book: BookSuggestion) => {
    try {
      const params = new URLSearchParams({ title: book.title, author: book.author });
      const res = await fetch(`/api/cover?${params}`);
      if (!res.ok) return;
      const { coverUrl } = await res.json();
      if (!coverUrl || coverUrl === book.coverUrl) return;
      setPicks((prev) => prev.map((p) => (sameBook(p, book) ? { ...p, coverUrl } : p)));
    } catch {
      // Keep the thumbnail we already have
    }
  };

  const pick = (suggestion: BookSuggestion) => {
    const isNew = picks.length < MAX_PICKS && !picks.some((p) => sameBook(p, suggestion));
    setPicks((prev) => {
      if (prev.length >= MAX_PICKS || prev.some((p) => sameBook(p, suggestion))) return prev;
      return [...prev, suggestion];
    });
    if (isNew) upgradeCover(suggestion);
    requestIdRef.current++; // drop any search still in flight
    setQuery('');
    setSuggestions([]);
    setHasSearched(false);
    setIsSearching(false);
    closeMenu();
    // Keep typing the next book right away
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removePick = (index: number) => {
    setPicks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const menuHasItems = isOpen && suggestions.length > 0;

    if (e.key === 'ArrowDown' && menuHasItems) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && menuHasItems) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (menuHasItems && activeIndex >= 0) {
        pick(suggestions[activeIndex]);
      } else if (!query.trim() && hasPicks && !isLoading) {
        // Empty search + Enter = Recommend
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  };

  // Close the menu when clicking anywhere outside the search area
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  // When the shelf is emptied, reset the search box too
  useEffect(() => {
    if (picks.length === 0) {
      requestIdRef.current++;
      setQuery('');
      setSuggestions([]);
      setHasSearched(false);
      setIsSearching(false);
      closeMenu();
    }
  }, [picks.length]);

  const showMenu = isOpen && query.trim().length >= 2 && (isSearching || hasSearched);
  const coverKey = (b: BookSuggestion) => `${b.title}|${b.author}`;

  return (
    <section className="shelf-page">
      <p className="note">Enter 1–5 books</p>

      {/* Search */}
      <div ref={searchRef} className="relative mt-4">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls="book-suggestions"
          aria-label="Search for a book"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={isFull ? 'Shelf full' : 'Search a title'}
          disabled={isLoading || isFull}
          autoFocus={autoFocusFirst}
          className="field__input w-full"
        />

        {showMenu && (
          <div
            id="book-suggestions"
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            className="menu"
          >
            {isSearching && suggestions.length === 0 ? (
              <div className="menu__item micro">Searching…</div>
            ) : suggestions.length === 0 ? (
              <div className="menu__item micro">No match. Try another spelling.</div>
            ) : (
              suggestions.map((sug, sIdx) => {
                const already = picks.some((p) => sameBook(p, sug));
                return (
                  <button
                    key={sIdx}
                    id={`suggestion-${sIdx}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === sIdx}
                    disabled={already}
                    onClick={() => pick(sug)}
                    onMouseEnter={() => setActiveIndex(sIdx)}
                    className={`menu__item ${activeIndex === sIdx ? 'is-active' : ''}`}
                  >
                    {sug.coverUrl ? (
                      <img src={sug.coverUrl} alt="" className="menu__thumb" />
                    ) : (
                      <span className="menu__thumb" />
                    )}
                    <span className="min-w-0 flex flex-col gap-1">
                      <span className="text-base leading-tight truncate">{sug.title}</span>
                      <span className="micro truncate">{already ? 'On your shelf' : sug.author}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Shelf: 5 slots, filled left to right */}
      <ol className="shelf" aria-label="Your books">
        {Array.from({ length: MAX_PICKS }).map((_, i) => {
          const book = picks[i];
          if (!book) {
            return <li key={`empty-${i}`} className="slot slot--empty" aria-hidden="true" />;
          }
          const showCover = book.coverUrl && !coverErrors[book.coverUrl]; // failures are per image
          return (
            <li key={coverKey(book)} className="slot">
              <div className="frame slot__frame">
                {showCover ? (
                  <img
                    src={book.coverUrl}
                    alt={`Cover of ${book.title}`}
                    onError={() => setCoverErrors((prev) => ({ ...prev, [book.coverUrl as string]: true }))}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-2 text-center">
                    <span className="micro line-clamp-4">{book.title}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePick(i)}
                  disabled={isLoading}
                  aria-label={`Remove ${book.title}`}
                  title="Remove"
                  className="slot__remove"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <span className="slot__title">{book.title}</span>
              <span className="slot__author">{book.author}</span>
            </li>
          );
        })}
      </ol>

      {/* Recommend floats at the bottom center, like Back on the results page */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!hasPicks || isLoading}
        className={`chip chip-lg display float-bottom ${isLoading ? '!opacity-100' : ''}`}
      >
        <ButtonLabel
          text={isLoading ? 'Searching…' : error ? 'Try again' : 'Recommend'}
          reserve="Recommend"
        />
      </button>

      <div aria-live="polite" className="mt-6 flex justify-center">
        {error && !isLoading && <p className="alert m-0">{error}</p>}
      </div>
    </section>
  );
};
