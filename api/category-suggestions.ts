type SuggestionInput = { id: string; name: string };
type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
};
type ResponseLike = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  status?(code: number): ResponseLike;
  json?(body: unknown): void;
  end(body?: string): void;
};
type Dependencies = {
  env: Record<string, string | undefined>;
  fetcher: FetchLike;
  now: () => number;
};
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ITEMS = 10;
const MAX_CATEGORIES = 40;
const MAX_PER_MINUTE = 24;
const rateWindows = new Map<string, { start: number; count: number }>();

function respond(res: ResponseLike, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  const statusMethod = res.status;
  const jsonMethod = res.json;
  if (statusMethod && jsonMethod) {
    statusMethod.call(res, status);
    jsonMethod.call(res, body);
    return;
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getHeader(req: RequestLike, name: string): string | undefined {
  const value = Object.entries(req.headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return Array.isArray(value) ? value[0] : value;
}

async function readJson(req: RequestLike): Promise<unknown> {
  const contentLength = Number(getHeader(req, 'content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) throw Object.assign(new Error(), { status: 413 });
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      throw Object.assign(new Error(), { status: 413 });
    }
    try {
      return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      throw Object.assign(new Error(), { status: 400 });
    }
  }
  if (!req[Symbol.asyncIterator]) throw Object.assign(new Error(), { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error(), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    throw Object.assign(new Error(), { status: 400 });
  }
}

function validateInput(value: unknown): { items: SuggestionInput[]; categories: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error(), { status: 400 });
  }
  const input = value as { items?: unknown; categories?: unknown };
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_ITEMS) {
    throw Object.assign(new Error(), { status: 400 });
  }
  if (
    !Array.isArray(input.categories) ||
    input.categories.length < 2 ||
    input.categories.length > MAX_CATEGORIES
  ) {
    throw Object.assign(new Error(), { status: 400 });
  }
  const categories = input.categories.map((category) =>
    typeof category === 'string' ? category.trim() : ''
  );
  if (
    categories.some((category) => !category || category.length > 60) ||
    new Set(categories.map((category) => category.toLowerCase())).size !== categories.length
  ) {
    throw Object.assign(new Error(), { status: 400 });
  }
  const ids = new Set<string>();
  const items = input.items.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw Object.assign(new Error(), { status: 400 });
    }
    const item = candidate as { id?: unknown; name?: unknown };
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!id || id.length > 80 || !/^[\w-]+$/.test(id) || !name || name.length > 80 || ids.has(id)) {
      throw Object.assign(new Error(), { status: 400 });
    }
    ids.add(id);
    return { id, name };
  });
  return { items, categories };
}

async function withTimeout(
  fetcher: FetchLike,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function limitRequest(req: RequestLike, now: number): boolean {
  for (const [address, activeWindow] of rateWindows) {
    if (now - activeWindow.start >= 60_000) rateWindows.delete(address);
  }
  const forwarded = getHeader(req, 'x-forwarded-for')?.split(',')[0]?.trim();
  const key = req.socket?.remoteAddress || forwarded || 'vercel-instance';
  let window = rateWindows.get(key);
  if (!window || now - window.start >= 60_000) {
    if (!window && rateWindows.size >= 1024) {
      const oldestAddress = rateWindows.keys().next().value;
      if (oldestAddress) rateWindows.delete(oldestAddress);
    }
    window = { start: now, count: 0 };
    rateWindows.set(key, window);
  }
  window.count += 1;
  return window.count <= MAX_PER_MINUTE;
}

export function createCategorySuggestionHandler(dependencies: Dependencies) {
  return async (req: RequestLike, res: ResponseLike): Promise<void> => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      respond(res, 405, { error: 'Method not allowed.' });
      return;
    }
    const authorization = getHeader(req, 'authorization') || '';
    const token = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
    if (!token) {
      respond(res, 401, { error: 'Sign in to suggest categories for this shared pantry.' });
      return;
    }
    const projectId = dependencies.env.PANTRY_FIREBASE_PROJECT_ID;
    const householdId = dependencies.env.PANTRY_HOUSEHOLD_ID;
    if (
      !projectId ||
      !householdId ||
      !/^[\w-]+$/.test(projectId) ||
      !/^[\w-]+$/.test(householdId)
    ) {
      respond(res, 503, { error: 'Category suggestions are not configured.' });
      return;
    }

    let membership: Response;
    try {
      membership = await withTimeout(
        dependencies.fetcher,
        `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/households/${encodeURIComponent(householdId)}`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
        5_000
      );
    } catch {
      respond(res, 503, { error: 'Could not verify shared pantry access. Try again shortly.' });
      return;
    }
    if (membership.status === 401 || membership.status === 403 || membership.status === 404) {
      respond(res, 403, { error: 'Your account is not a member of this shared pantry.' });
      return;
    }
    if (!membership.ok) {
      respond(res, 503, { error: 'Could not verify shared pantry access. Try again shortly.' });
      return;
    }
    if (!dependencies.env.TYPESAFE_API_KEY) {
      respond(res, 503, { error: 'Category suggestions are temporarily unavailable.' });
      return;
    }
    if (!limitRequest(req, dependencies.now())) {
      respond(res, 429, { error: 'Too many category requests. Try again in a minute.' });
      return;
    }

    let items: SuggestionInput[];
    let categories: string[];
    try {
      ({ items, categories } = validateInput(await readJson(req)));
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 400;
      respond(res, status, {
        error: status === 413 ? 'Request is too large.' : 'Invalid category request.'
      });
      return;
    }

    const categoryKeys = categories.map((_, index) => `category_${index}`);
    const criteria = Object.fromEntries(categoryKeys.map((key, index) => [key, categories[index]]));
    const questions = Object.fromEntries(
      items.map((_, index) => [
        `food_${index}`,
        {
          type: 'choice',
          instructions: `Choose the best pantry category for food number ${index + 1} in state. Use only the category that fits the food name.`,
          criteria
        }
      ])
    );

    let provider: Response;
    try {
      provider = await withTimeout(
        dependencies.fetcher,
        ENDPOINT,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${dependencies.env.TYPESAFE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            state: JSON.stringify({ foods: items.map((item) => item.name), categories }),
            model: 'jev-latest',
            questions
          })
        },
        12_000
      );
    } catch (error) {
      const timedOut = (error as Error).name === 'AbortError';
      respond(res, timedOut ? 504 : 502, {
        error: timedOut
          ? 'Category suggestions timed out. Try again shortly.'
          : 'Category suggestions are temporarily unavailable.'
      });
      return;
    }
    if (provider.status === 429) {
      respond(res, 429, { error: 'The suggestion service is busy. Try again shortly.' });
      return;
    }
    if (!provider.ok) {
      respond(res, 502, { error: 'Category suggestions are temporarily unavailable.' });
      return;
    }

    let payload: any;
    try {
      payload = await provider.json();
    } catch {
      respond(res, 502, { error: 'The suggestion service returned an invalid response.' });
      return;
    }
    const answers = payload?.answers;
    const suggestions = items.map((item, index) => {
      const answer = answers?.[`food_${index}`];
      const categoryIndex = categoryKeys.indexOf(answer?.choice);
      const confidence = answer?.confidence;
      if (
        answer?.type !== 'choice' ||
        categoryIndex < 0 ||
        typeof confidence !== 'number' ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1
      ) {
        return null;
      }
      return { id: item.id, category: categories[categoryIndex], confidence };
    });
    if (suggestions.some((suggestion) => !suggestion)) {
      respond(res, 502, { error: 'The suggestion service returned an invalid category.' });
      return;
    }
    respond(res, 200, { suggestions });
  };
}

const handler = createCategorySuggestionHandler({
  env: process.env,
  fetcher: fetch,
  now: Date.now
});

export default handler;
