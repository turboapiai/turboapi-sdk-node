/** Task execution statuses matching the backend. */
export const TaskStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  STARTING: 'starting',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

const TERMINAL_STATUSES: readonly TaskStatus[] = [
  TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELLED, TaskStatus.TIMEOUT,
];
const ACTIVE_STATUSES: readonly TaskStatus[] = [
  TaskStatus.QUEUED, TaskStatus.STARTING, TaskStatus.PROCESSING,
];

export function isTerminal(status: TaskStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isActive(status: TaskStatus): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** Task priority levels. */
export const TaskPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

/** A single log entry for a task execution. */
export interface TaskLogItem {
  timestamp: string;
  level: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Full task response with status and optional output. */
export interface TaskResponse {
  id: string;
  task_id: string;
  name: string;
  status?: TaskStatus;
  progress: number;
  total_items: number;
  completed_items: number;
  failed_items: number;
  message?: string;
  error_message?: string;
  output?: unknown;
  api_slug?: string;
  priority?: string;
  prediction_id?: string;
  retry_count: number;
  max_retries: number;
  logs?: TaskLogItem[];
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
}

/** Pagination metadata from list responses. */
export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Paginated list of tasks. */
export interface TaskListResponse {
  items: TaskResponse[];
  pagination: PaginationMeta;
}

/** API market item returned by the backend. */
export interface APIResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category_id?: number;
  endpoint?: string;
  method?: string;
  documentation?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  status: string;
  is_official: boolean;
  api_type?: string;
  handler_name?: string;
  upstream_platform_id?: string;
  parameters?: Record<string, unknown>;
  tags: string[];
  config_json?: Record<string, unknown>;
  show_detail: boolean;
  created_at?: string;
  updated_at?: string;
}

/** API category item. */
export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  sort_order: number;
  created_at?: string;
}

/** Paginated API list response. */
export interface APIListResponse {
  items: APIResponse[];
  pagination: PaginationMeta;
}

/** Paginated categories list response. */
export interface CategoriesListResponse {
  items: CategoryResponse[];
  pagination: PaginationMeta;
}

/** Inner envelope returned by the backend API. */
export interface BackendResponse<T> {
  success: boolean;
  data?: T;
  meta?: {
    request_id: string;
    timestamp: string;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
