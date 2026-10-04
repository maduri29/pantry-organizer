import type { CategorySuggestion, CategorySuggestionInput } from './types.ts';

export async function requestCategorySuggestions(
  token: string,
  items: CategorySuggestionInput[],
  categories: string[],
  signal?: AbortSignal
): Promise<CategorySuggestion[]> {
  const response = await fetch('/api/category-suggestions', {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items })
  });
  const result = (await response.json().catch(() => null)) as {
    suggestions?: unknown;
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(result?.error || 'Category suggestions are temporarily unavailable.');
  }
  if (!Array.isArray(result?.suggestions)) {
    throw new Error('The suggestion service returned an invalid response.');
  }
  return result.suggestions as CategorySuggestion[];
}
