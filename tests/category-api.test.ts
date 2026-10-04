import { describe, expect, test } from 'bun:test';
import { createCategorySuggestionHandler } from '../api/category-suggestions.ts';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const env = {
  PANTRY_FIREBASE_PROJECT_ID: 'pantry-test',
  PANTRY_HOUSEHOLD_ID: 'household-test',
  TYPESAFE_API_KEY: 'server-test-key'
};
const input = {
  items: [{ id: 'food-1', name: 'Long grain rice' }],
  // Legacy client categories must not become Jev destinations.
  categories: ['Fruit', 'Grains & pulses', 'Other']
};

async function call(
  options: {
    method?: string;
    authorization?: string;
    body?: unknown;
    fetcher?: FetchLike;
    env?: Record<string, string | undefined>;
  } = {}
) {
  const headers: Record<string, string> = {};
  if (options.authorization) headers.authorization = options.authorization;
  const req = {
    method: options.method || 'POST',
    headers,
    body: options.body === undefined ? input : options.body,
    socket: { remoteAddress: 'test-client' }
  };
  const result: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers
  };
  const res = {
    setHeader: (name: string, value: string) => {
      result.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
    },
    end(body?: string) {
      result.body = body ? JSON.parse(body) : undefined;
    }
  };
  let now = 0;
  const handler = createCategorySuggestionHandler({
    env: options.env || env,
    fetcher:
      options.fetcher ||
      (async () => {
        throw new Error('Unexpected provider call');
      }),
    now: () => now++
  });
  await handler(req, res);
  return result;
}

const memberOk = () => new Response('{}', { status: 200 });

describe('Jev category API', () => {
  test('rejects missing auth and non-members before calling Jev', async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response('{}', { status: 403 });
    }) as FetchLike;
    const anonymous = await call({ fetcher });
    expect(anonymous.status).toBe(401);
    expect(calls).toBe(0);
    const nonMember = await call({ authorization: 'Bearer user-token', fetcher });
    expect(nonMember.status).toBe(403);
    expect(calls).toBe(1);
  });

  test('rejects invalid bounded input before calling the provider', async () => {
    let providerCalls = 0;
    const fetcher = (async (url: string | URL | Request) => {
      if (String(url).includes('firestore.googleapis.com')) return memberOk();
      providerCalls += 1;
      return new Response('{}', { status: 200 });
    }) as FetchLike;
    const response = await call({
      authorization: 'Bearer member-token',
      body: {
        ...input,
        items: Array.from({ length: 11 }, (_, index) => ({ id: `id-${index}`, name: 'Food' }))
      },
      fetcher
    });
    expect(response.status).toBe(400);
    expect(providerCalls).toBe(0);
  });

  test('maps Jev choices to submitted categories without sending inventory details', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('firestore.googleapis.com')) return memberOk();
      return new Response(
        JSON.stringify({
          answers: {
            food_0: { type: 'choice', choice: 'category_2', confidence: 0.94 }
          }
        }),
        { status: 200 }
      );
    }) as FetchLike;
    const response = await call({ authorization: 'Bearer member-token', fetcher });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suggestions: [{ id: 'food-1', category: 'Rice & grains', confidence: 0.94 }]
    });
    const provider = calls[1];
    expect(provider.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(new Headers(provider.init?.headers).get('authorization')).toBe('Bearer server-test-key');
    const body = JSON.parse(String(provider.init?.body));
    expect(body.model).toBe('jev-latest');
    const providerState = JSON.parse(body.state);
    expect(providerState.foods).toEqual(['Long grain rice']);
    expect(providerState.categories).toHaveLength(29);
    expect(providerState.categories[2].label).toBe('Rice & grains');
    expect(providerState.categories[2].guidance).toContain('poha');
    expect(providerState.categories.some((category: { label: string }) => category.label === 'Grains & pulses')).toBe(false);
    expect(body.questions.food_0.instructions).toContain('Long grain rice');
    expect(body.questions.food_0.criteria.category_2).toContain('Rice & grains:');
    expect(body.questions.food_0.criteria.category_4).toContain('Dals & beans:');
    expect(body.questions.food_0.criteria.category_14).toContain('Nuts & seeds:');
    expect(body.questions.food_0.criteria.category_29).toBeUndefined();
    expect(Object.keys(body.questions.food_0.criteria)).toHaveLength(29);
    expect(JSON.stringify(body)).not.toContain('food-1');
    expect(JSON.stringify(body)).not.toContain('amount');
    expect(response.headers['cache-control']).toContain('no-store');
  });

  test('rejects invalid returned category and confidence', async () => {
    for (const answer of [
      { type: 'choice', choice: 'made-up', confidence: 0.8 },
      { type: 'choice', choice: 'category_0', confidence: 2 }
    ]) {
      const fetcher = (async (url: string | URL | Request) =>
        String(url).includes('firestore.googleapis.com')
          ? memberOk()
          : new Response(JSON.stringify({ answers: { food_0: answer } }), {
              status: 200
            })) as FetchLike;
      expect((await call({ authorization: 'Bearer member-token', fetcher })).status).toBe(502);
    }
  });

  test('handles provider rate limits and timeouts with safe errors', async () => {
    const rateLimited = (async (url: string | URL | Request) =>
      String(url).includes('firestore.googleapis.com')
        ? memberOk()
        : new Response('{}', { status: 429 })) as FetchLike;
    const busy = await call({ authorization: 'Bearer member-token', fetcher: rateLimited });
    expect(busy.status).toBe(429);
    expect(JSON.stringify(busy.body)).not.toContain('server-test-key');

    const timedOut = (async (url: string | URL | Request) => {
      if (String(url).includes('firestore.googleapis.com')) return memberOk();
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as FetchLike;
    expect((await call({ authorization: 'Bearer member-token', fetcher: timedOut })).status).toBe(
      504
    );
  });

  test('rejects oversized content length before provider use', async () => {
    const handler = createCategorySuggestionHandler({
      env,
      fetcher: (async () => memberOk()) as FetchLike,
      now: Date.now
    });
    const result: any = {
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      status(status: number) {
        this.statusCode = status;
        return this;
      },
      json(body: unknown) {
        this.body = body;
      }
    };
    await handler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer member-token', 'content-length': '17000' },
        body: input
      },
      result
    );
    expect(result.statusCode).toBe(413);
    expect(result.headers['Cache-Control']).toContain('no-store');
  });
});
