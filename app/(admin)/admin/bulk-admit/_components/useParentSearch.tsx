"use client";

import type { ParentSearchResult } from "@/lib/actions/admit";
import { searchParentsAction } from "@/lib/actions/admit";
import { useEffect, useReducer, useTransition } from "react";

// ── State & Reducer ───────────────────────────────────────────────────────

interface SearchState {
  results: ParentSearchResult[];
  loading: boolean;
  isOpen: boolean;           // renamed for clarity
}

type SearchAction =
  | { type: "SEARCH_START" }
  | { type: "SEARCH_SUCCESS"; results: ParentSearchResult[] }
  | { type: "CLEAR" }
  | { type: "CLOSE" }
  | { type: "OPEN" };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "SEARCH_START":
      return { ...state, loading: true };
    case "SEARCH_SUCCESS":
      return {
        results: action.results,
        loading: false,
        isOpen: action.results.length > 0,
      };
    case "CLEAR":
      return { results: [], loading: false, isOpen: false };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "OPEN":
      return { ...state, isOpen: state.results.length > 0 };
    default:
      return state;
  }
}

const INITIAL_STATE: SearchState = {
  results: [],
  loading: false,
  isOpen: false,
};

// ── Debounce Hook ─────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, dispatch] = useReducer((_: T, next: T) => next, value);

  useEffect(() => {
    const handler = setTimeout(() => dispatch(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ── Main Hook ─────────────────────────────────────────────────────────────

export function useParentSearch(query: string) {
  const [state, dispatch] = useReducer(searchReducer, INITIAL_STATE);
  const [, startTransition] = useTransition();
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      startTransition(() => dispatch({ type: "CLEAR" }));
      return;
    }

    let isCancelled = false;

    // Start loading
    startTransition(() => dispatch({ type: "SEARCH_START" }));

    searchParentsAction(debouncedQuery).then((response) => {
      if (isCancelled) return;

      startTransition(() => {
        dispatch({
          type: "SEARCH_SUCCESS",
          results: response.data ?? [],
        });
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery]);

  // Exposed actions
  const open = () => dispatch({ type: "OPEN" });
  const close = () => dispatch({ type: "CLOSE" });

  return {
    results: state.results,
    loading: state.loading,
    isOpen: state.isOpen,        // ← Boolean for aria-expanded
    open,                        // ← Function to open dropdown
    close,
  };
}