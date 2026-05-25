# TurboAPI SDK (Node.js / TypeScript)

TypeScript client for calling AI services through [TurboAPI](https://turboapi.ai).

## Installation

```bash
npm install @turboapi/sdk
# or
pnpm add @turboapi/sdk
```

## Quick Start

```typescript
import { TurboAPIClient } from '@turboapi/sdk';

const client = new TurboAPIClient({ apiKey: 'tbp_your_api_key' });

// Create a task and wait for result
const result = await client.call.createAndWait('karaoke-maker', {
  audio_file: 'https://example.com/song.mp3',
  task_key: 'my-first-task',
});
console.log(`Task completed! Output:`, result.output);

// Manual two-step
const task = await client.call.create('some-api', { key: 'value' });
console.log(`Task ID: ${task.task_id}, Status: ${task.status}`);

// Poll for updates
const updated = await client.call.get(task.task_id);
if (isTerminal(updated.status!)) {
  console.log(`Output:`, updated.output);
}

// Cancel a queued task
await client.call.cancel(task.task_id);

// List recent tasks
const list = await client.tasks.list({ status: 'succeeded', page: 1, pageSize: 10 });
for (const t of list.items) {
  console.log(`${t.task_id}: ${t.name} - ${t.status}`);
}

// Browse available APIs
const apis = await client.apis.list({ category: 'ai', search: 'video' });
for (const api of apis.items) {
  console.log(`${api.name} (${api.slug})`);
}

// Get API detail
const detail = await client.apis.get('karaoke-maker');
console.log(`API: ${detail.name} — ${detail.description}`);
```

## API

### TurboAPIClient

```typescript
const client = new TurboAPIClient({
  apiKey: 'tbp_xxxxx',
  baseURL?: 'https://turboapi.ai/api/v1',
});
```

### Call Module (`client.call`)

| Method | Description |
|--------|-------------|
| `create(slugId, input)` | Submit a task |
| `get(taskId)` | Get task status & result |
| `cancel(taskId)` | Cancel a queued task |
| `createAndWait(slugId, input, opts?)` | Submit & block until complete |

### Tasks Module (`client.tasks`)

| Method | Description |
|--------|-------------|
| `list(opts?)` | List your tasks with filters |
| `get(taskId)` | Get task detail |
| `logs(taskId, opts?)` | Get execution logs |

### Apis Module (`client.apis`)

| Method | Description |
|--------|-------------|
| `list(opts?)` | Browse available APIs in the marketplace |
| `get(slug)` | Get details of a specific API |
| `categories(opts?)` | List API categories |

## Error Handling

```typescript
import { AuthenticationError, RateLimitError, NotFoundError, TimeoutError } from '@turboapi/sdk';

try {
  const result = await client.call.createAndWait('some-api', { key: 'value' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Check your API key');
  } else if (error instanceof RateLimitError) {
    console.error(`Slow down! Retry after ${error.retryAfter}s`);
  } else if (error instanceof NotFoundError) {
    console.error('Task or API not found');
  } else if (error instanceof TimeoutError) {
    console.error('Task did not complete in time');
  } else {
    console.error('Error:', error);
  }
}
```

## Task Statuses

| Status | Terminal | Description |
|--------|----------|-------------|
| `pending` | No | Waiting to be queued |
| `queued` | No | In queue |
| `starting` | No | Worker starting |
| `processing` | No | Executing |
| `succeeded` | Yes | Completed |
| `failed` | Yes | Failed |
| `cancelled` | Yes | Cancelled |
| `timeout` | Yes | Timed out |
