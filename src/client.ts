import { ofetch } from 'ofetch';

import type {
  APIListResponse,
  APIResponse,
  BackendResponse,
  CategoriesListResponse,
  TaskListResponse,
  TaskResponse,
  TaskStatus,
} from './types';
import {
  createErrorFromResponse,
  NetworkError,
  TimeoutError,
  TurboAPIError,
} from './errors';

const DEFAULT_BASE_URL = 'https://turboapi.ai/api/v1';

/** Options passed when creating a TurboAPIClient. */
export interface ClientOptions {
  /** TurboAPI API key. */
  apiKey?: string;
  /** Base URL for the TurboAPI backend. Defaults to https://turboapi.ai/api/v1. */
  baseURL?: string;
}

/** Options for CallModule.createAndWait. */
export interface CreateAndWaitOptions {
  /** Maximum time to wait in milliseconds (default 300000). */
  timeout?: number;
  /** Polling interval in milliseconds (default 2000). */
  pollInterval?: number;
}

/** Options for TasksModule.list. */
export interface ListTasksOptions {
  status?: TaskStatus;
  apiSlug?: string;
  page?: number;
  pageSize?: number;
}

/** Options for TasksModule.logs. */
export interface ListLogsOptions {
  page?: number;
  pageSize?: number;
}

/** Options for ApisModule.list. */
export interface ListAPIOptions {
  page?: number;
  pageSize?: number;
  category?: string;
  tags?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

/** API Market listing and discovery module. */
class ApisModule {
  constructor(private client: TurboAPIClient) {}

  /** List available APIs in the marketplace. */
  async list(opts?: ListAPIOptions): Promise<APIListResponse> {
    const params: Record<string, string> = {
      page: String(opts?.page ?? 1),
      page_size: String(opts?.pageSize ?? 20),
      sort_by: opts?.sortBy ?? 'created_at',
      sort_order: opts?.sortOrder ?? 'desc',
    };
    if (opts?.category) params.category = opts.category;
    if (opts?.tags?.length) params.tags = opts.tags.join(',');
    if (opts?.search) params.search = opts.search;

    const data = await this.client._request<Record<string, unknown>>('GET', '/apis', { params });
    return data as unknown as APIListResponse;
  }

  /** Get details of a specific API by its slug. */
  async get(slug: string): Promise<APIResponse> {
    const data = await this.client._request<Record<string, unknown>>('GET', `/apis/${slug}`);
    return data as unknown as APIResponse;
  }

  /** List API categories. */
  async categories(opts?: { page?: number; pageSize?: number }): Promise<CategoriesListResponse> {
    const params: Record<string, string> = {
      page: String(opts?.page ?? 1),
      page_size: String(opts?.pageSize ?? 20),
    };
    return this.client._request('GET', '/apis/categories', { params }) as Promise<CategoriesListResponse>;
  }
}

/** Task creation and management module. */
class CallModule {
  constructor(private client: TurboAPIClient) {}

  /** Submit a task for execution. */
  async create(
    slugId: string,
    input: Record<string, unknown>,
  ): Promise<TaskResponse> {
    const data = await this.client._request<Record<string, unknown>>('POST', '/call', {
      body: { slug_id: slugId, input },
    });
    return data as unknown as TaskResponse;
  }

  /** Get the current status and details of a task. */
  async get(taskId: string): Promise<TaskResponse> {
    const data = await this.client._request<Record<string, unknown>>('GET', `/call/${taskId}`);
    return data as unknown as TaskResponse;
  }

  /** Request cancellation of a queued task. */
  async cancel(taskId: string): Promise<void> {
    await this.client._request('POST', `/call/${taskId}/cancel`);
  }

  /** Submit a task and block until it completes or fails. */
  async createAndWait(
    slugId: string,
    input: Record<string, unknown>,
    opts?: CreateAndWaitOptions,
  ): Promise<TaskResponse> {
    const timeout = opts?.timeout ?? 300_000;
    const pollInterval = opts?.pollInterval ?? 2_000;

    let task = await this.create(slugId, input);
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      task = await this.get(task.task_id);

      if (task.status) {
        const { isTerminal } = await import('./types');
        if (isTerminal(task.status)) {
          return task;
        }
      }

      const remaining = deadline - Date.now();
      const sleep = Math.min(pollInterval, remaining);
      if (sleep <= 0) break;
      await new Promise((r) => setTimeout(r, sleep));
    }

    throw new TimeoutError(
      `Task ${task.task_id} did not complete within ${timeout}ms`,
      { task_id: task.task_id, last_status: task.status },
    );
  }
}

/** Task listing and querying module. */
class TasksModule {
  constructor(private client: TurboAPIClient) {}

  /** List tasks for the authenticated user. */
  async list(opts?: ListTasksOptions): Promise<TaskListResponse> {
    const params: Record<string, string> = {
      page: String(opts?.page ?? 1),
      page_size: String(opts?.pageSize ?? 20),
    };
    if (opts?.status) params.status = opts.status;
    if (opts?.apiSlug) params.api_slug = opts.apiSlug;

    const data = await this.client._request<Record<string, unknown>>('GET', '/tasks', { params });
    return data as unknown as TaskListResponse;
  }

  /** Get a specific task's full detail. */
  async get(taskId: string): Promise<TaskResponse> {
    const data = await this.client._request<Record<string, unknown>>('GET', `/tasks/${taskId}`);
    return data as unknown as TaskResponse;
  }

  /** Get execution logs for a task. */
  async logs(
    taskId: string,
    opts?: ListLogsOptions,
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {
      page: String(opts?.page ?? 1),
      page_size: String(opts?.pageSize ?? 50),
    };
    return this.client._request('GET', `/tasks/${taskId}/logs`, { params });
  }
}

/**
 * TurboAPI client for calling AI services.
 *
 * ```ts
 * const client = new TurboAPIClient({ apiKey: 'tbp_xxxxx' });
 *
 * // Quick call with blocking wait
 * const result = await client.call.createAndWait('karaoke-maker', {
 *   audio_file: 'https://...',
 * });
 * console.log(result.output);
 * ```
 */
export class TurboAPIClient {
  public readonly apis: ApisModule;
  public readonly call: CallModule;
  public readonly tasks: TasksModule;

  private readonly baseURL: string;
  private readonly apiKey?: string;

  constructor(opts?: ClientOptions) {
    this.baseURL = opts?.baseURL ?? DEFAULT_BASE_URL;
    this.apiKey = opts?.apiKey;
    this.apis = new ApisModule(this);
    this.call = new CallModule(this);
    this.tasks = new TasksModule(this);
  }

  async _request<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; params?: Record<string, string> },
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const fetchOpts = {
      method: method as 'GET' | 'POST' | 'PATCH' | 'DELETE',
      headers,
    } as const;

    try {
      const body = await ofetch<BackendResponse<T>>(url, {
        ...fetchOpts,
        body: opts?.body as string | undefined,
        params: opts?.params,
      });

      if (!body.success) {
        throw createErrorFromResponse(200, body);
      }

      return body.data as T;
    } catch (err) {
      if (err instanceof TurboAPIError) throw err;

      const typed = err as { status?: number; data?: BackendResponse<T>; message?: string };

      if (typed.status && typed.data) {
        throw createErrorFromResponse(typed.status, typed.data);
      }

      if (typed.message) {
        throw new NetworkError(typed.message);
      }

      throw new NetworkError('Unknown network error');
    }
  }
}
