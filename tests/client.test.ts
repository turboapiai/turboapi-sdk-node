import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOfetch = vi.fn();
vi.mock('ofetch', () => ({
  ofetch: (url: string, opts: any) => mockOfetch(url, opts),
}));

import { TurboAPIClient, type ListAPIOptions } from '../src/client';
import { TaskStatus } from '../src/types';
import { AuthenticationError, NotFoundError, RateLimitError } from '../src/errors';

function createClient() {
  return new TurboAPIClient({ apiKey: 'test-key', baseURL: 'https://test.api/v1' });
}

function mockResponse(data: unknown) {
  mockOfetch.mockResolvedValue({ success: true, data });
}

function mockError(status: number, code: string, message: string, details?: Record<string, unknown>) {
  mockOfetch.mockRejectedValue({
    status,
    data: {
      success: false,
      error: { code, message, details },
      meta: { request_id: 'req-123', timestamp: '2026-01-01T00:00:00Z' },
    },
  });
}

describe('ApisModule', () => {
  it('lists APIs', async () => {
    mockResponse({
      items: [
        { id: '1', name: 'Karaoke Maker', slug: 'karaoke-maker', status: 'published' },
        { id: '2', name: 'Minimax Music', slug: 'minimax-music-2.6', status: 'published' },
      ],
      pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
    });

    const client = createClient();
    const result = await client.apis.list();

    expect(result.items.length).toBe(2);
    expect(result.items[0].slug).toBe('karaoke-maker');
    expect(result.pagination.total).toBe(2);
  });

  it('gets API detail', async () => {
    mockResponse({
      id: '1',
      name: 'Karaoke Maker',
      slug: 'karaoke-maker',
      description: 'Generate karaoke videos',
      status: 'published',
      parameters: {
        input: {
          type: 'object',
          properties: { audio_file: { type: 'string', format: 'uri' } },
          required: ['audio_file'],
        },
      },
    });

    const client = createClient();
    const api = await client.apis.get('karaoke-maker');

    expect(api.slug).toBe('karaoke-maker');
    expect(api.description).toBe('Generate karaoke videos');
  });

  it('lists APIs with filters', async () => {
    mockResponse({
      items: [{ id: '1', name: 'Karaoke Maker', slug: 'karaoke-maker', status: 'published' }],
      pagination: { total: 1, page: 1, page_size: 10, total_pages: 1 },
    });

    const client = createClient();
    const result = await client.apis.list({
      page: 1,
      pageSize: 10,
      category: 'ai',
      search: 'video',
      sortBy: 'name',
      sortOrder: 'asc' as const,
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].slug).toBe('karaoke-maker');
  });
});

describe('TurboAPIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a task', async () => {
    mockResponse({
      id: 'task-001',
      task_id: 'task-001',
      name: 'karaoke-maker',
      status: 'queued',
    });

    const client = createClient();
    const task = await client.call.create('karaoke-maker', { k: 'v' });

    expect(task.task_id).toBe('task-001');
    expect(task.name).toBe('karaoke-maker');
    expect(mockOfetch).toHaveBeenCalledTimes(1);
  });

  it('gets task status', async () => {
    mockResponse({
      id: 'task-001',
      task_id: 'task-001',
      name: 'karaoke-maker',
      status: 'succeeded',
      output: { url: 'https://example.com/r.mp4' },
    });

    const client = createClient();
    const task = await client.call.get('task-001');

    expect(task.status).toBe(TaskStatus.SUCCEEDED);
  });

  it('cancels a task', async () => {
    mockResponse({ message: 'Task cancelled' });

    const client = createClient();
    await expect(client.call.cancel('task-001')).resolves.toBeUndefined();
  });

  it('lists tasks', async () => {
    mockResponse({
      items: [
        { id: 't1', task_id: 't1', name: 'api-a', status: 'succeeded' },
        { id: 't2', task_id: 't2', name: 'api-b', status: 'processing' },
      ],
      pagination: { total: 2, page: 1, page_size: 20, total_pages: 1 },
    });

    const client = createClient();
    const list = await client.tasks.list();

    expect(list.items.length).toBe(2);
    expect(list.pagination.total).toBe(2);
  });

  it('throws AuthenticationError', async () => {
    mockError(401, 'UNAUTHORIZED', 'Invalid API key');

    const client = createClient();
    await expect(client.tasks.list()).rejects.toThrow(AuthenticationError);
  });

  it('throws NotFoundError', async () => {
    mockError(404, 'NOT_FOUND', 'Task not found');

    const client = createClient();
    await expect(client.call.get('missing')).rejects.toThrow(NotFoundError);
  });

  it('throws RateLimitError with retry_after', async () => {
    mockError(429, 'RATE_LIMITED', 'Too fast', { retry_after: 30 });

    const client = createClient();
    try {
      await client.call.create('x', { k: 'v' });
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).retryAfter).toBe(30);
    }
  });
});
