# Presentation + Infrastructure Layer: Integrations, Logger, Queue

Date: 2026-09-13
Status: Approved

## Context

The project currently has only a domain layer (entities: `Step`, `Pipeline`, `Connector`, `Execution`) and an
application layer (repository ports, DTOs, use cases for Step/Pipeline/Connector/Execution CRUD). There are no
concrete repository implementations, no database, no HTTP controllers beyond the generated Nest boilerplate
(`AppController`/`AppService`), and no queueing or WebSocket infrastructure.

This spec covers building the presentation layer (NestJS controllers + WebSocket gateways) and the infrastructure
layer (MongoDB repositories, BullMQ-backed execution queue) needed to expose three subsystems:

1. **Integrations** — CRUD over Pipeline "schemas" (JSON import/export via the existing `SchemaAdapter`), over
   both HTTP and WebSocket.
2. **Logger** — a persisted log trail (`LogEntry`) that pipeline execution and steps write to, with its own CRUD.
3. **Queue** — a BullMQ-backed mechanism to run pipeline executions concurrently (parallel across executions;
   sequential within a single pipeline's steps).

All new code must obey the existing Clean Architecture rules already codified for this repo: dependencies point
inward, domain/application stay framework- and DB-free, repository ports are owned by the application layer and
implemented by infrastructure, controllers/gateways are thin and only call use cases.

## Goals

- Persist Step/Pipeline/Connector/Execution/LogEntry entities in MongoDB via repository implementations of the
  existing (and one new) ports.
- Expose Integrations CRUD (backed by Pipeline) over HTTP and WebSocket, with WS broadcasting change events.
- Expose Logger CRUD over HTTP, and wire a `LoggerPort` that pipeline execution/steps use to write log entries.
- Implement a queue-driven pipeline execution flow: enqueue on `POST /executions`, process concurrently with
  BullMQ, execute each step via a `StepExecutor` per `StepKind`, and track `Execution` status transitions.

## Non-goals

- Authentication/authorization on the new endpoints.
- Production-grade retry/backoff tuning, dead-letter queues, or job monitoring UI.
- Full JSON Schema validation library integration for the VALIDATE step (a basic shape check is enough).
- Running steps of a single pipeline in parallel with each other (Pipeline's step chain stays sequential).

## Data model changes

### Pipeline entity

Add optional metadata fields directly to `Pipeline` ([pipeline.ts](../../../src/domain/entities/pipeline.ts)):

```ts
export class Pipeline extends Entity {
  constructor(
    public readonly id: PipelineId,
    private readonly steps: Step[],
    public status: PipelineStatus = PipelineStatus.IDLE,
    public name?: string,
    public description?: string,
  ) { ... }
}
```

This removes the need for the separate two-id `metadata` wrapper in `Schema` ([schema.ts](../../../src/@types/schema.ts)).
Simplify `Schema` to:

```ts
export type Schema = {
  pipeline: Pipeline;
};
```

`CreatePipelineDTO`/`UpdatePipelineDTO` gain optional `name`/`description` fields; the corresponding use cases pass
them through to the `Pipeline` constructor.

### LogEntry entity (new)

- `src/@types/IDs.ts`: add `LogEntryId` (same string-branding pattern as the others).
- `src/domain/entities/log-entry.ts`:

```ts
export type LogLevel = 'info' | 'warn' | 'error';

export class LogEntry extends Entity {
  constructor(
    readonly id: LogEntryId,
    readonly level: LogLevel,
    readonly message: string,
    readonly context?: Record<string, unknown>,
    readonly executionId?: ExecutionId,
  ) {
    super();
  }
}
```

- `src/application/repositories/log-entry.repository.ts`:

```ts
export interface LogEntryRepository {
  createLogEntry(logEntry: LogEntry): Promise<boolean>;
  deleteLogEntry(logEntry: LogEntry): Promise<boolean>;
  existsById(logEntryId: string): Promise<LogEntry | null>;
  getAllLogEntries(): Promise<LogEntry[]>;
}
```

(No update — log entries are immutable once written.)

- DTOs in `src/application/dtos/log-entry/`: `create-log-entry.dto.ts`, `delete-log-entry.dto.ts`,
  `get-log-entry-by-id.dto.ts` — same shape convention as the other entities.
- Use cases in `src/application/use-cases/log-entry/`: `create-log-entry.use-case.ts`,
  `delete-log-entry.use-case.ts`, `get-log-entry-by-id.use-case.ts`, `get-all-log-entries.use-case.ts`.
- Add `LogEntryNotFoundError` to [domain.ts](../../../src/shared/errors/domain.ts).

## Infrastructure layer

### MongoDB

New dependency: `@nestjs/mongoose`, `mongoose`.

`src/infrastructure/database/database.module.ts` — a global `MongooseModule.forRootAsync` reading `MONGODB_URI`
from `@nestjs/config`.

Per entity, under `src/infrastructure/database/{entity}/`:
- `{entity}.schema.ts` — a Mongoose `@Schema()` class + `SchemaFactory.createForClass(...)`. This is the *only*
  place Mongoose decorators exist; it must not be imported by domain/application code.
- `{entity}.mapper.ts` — extends `Mapper<Entity, Document>` (existing base class in
  [mapper.ts](../../../src/base/mapper.ts)): `mapFrom(document) => Entity`, `mapTo(entity) => plain object for
  Mongoose`.
- `{entity}.mongo.repository.ts` — implements the application-layer port (`@Injectable()`, injects the Mongoose
  `Model` via `@InjectModel`), uses the mapper to convert in/out.

Repositories to implement: `StepRepository`, `PipelineRepository` (embeds its `Step[]` as a subdocument array),
`ConnectorRepository`, `ExecutionRepository`, `LogEntryRepository`.

Each is registered as the provider for its port's DI token in the module that needs it (see Wiring below).

### Step execution

`src/infrastructure/execution/step-executor.ts`:

```ts
export interface StepExecutor {
  execute(step: Step, payload: unknown): Promise<StepResult>;
}
```

One implementation per `StepKind`, selected by a small `StepExecutorRegistry` (a `Record<StepKind, StepExecutor>`
built at module init — no `switch` sprawl in the processor):

- `ReceiveStepExecutor` — passes `payload` through unchanged (`StepConfig` kind RECEIVE just carries `source`,
  there's no live inbound listener in this pass — the payload arrives as the job's input).
- `ValidateStepExecutor` — basic shape check: for each top-level key in `config.schema`, verify the key exists
  on `payload` (typeof/presence check, not full JSON Schema semantics).
- `TransformStepExecutor` — applies each `FieldMapping` (`sourcePath`→`targetPath`, optional `transform`:
  `toUpperCase`/`toISODate`/`identity`) using simple `$.a.b` dot-path get/set (no external JSONPath dependency
  needed for this shape).
- `DispatchStepExecutor` — performs a real `fetch(destination.url, { method, headers, body: JSON.stringify(payload) })`;
  non-2xx response becomes a `StepResult` with `status: 'FAILED'`.
- `LogStepExecutor` — calls `LoggerPort.log(config.level, ...)` and passes the payload through.

Each executor returns a `StepResult` (existing type in [step.ts](../../../src/domain/entities/step.ts)).

### Logger port

`src/application/ports/logger.port.ts` (new `ports` folder alongside `repositories`, since this isn't a
persistence gateway but still an application-owned boundary):

```ts
export interface LoggerPort {
  log(level: LogLevel, message: string, context?: Record<string, unknown>, executionId?: ExecutionId): Promise<void>;
}
```

`src/infrastructure/logging/mongo-logger.service.ts` implements it by constructing a `LogEntry` (via
`generateID()`) and calling `CreateLogEntryUseCase`.

### Queue

New dependencies: `@nestjs/bullmq`, `bullmq`, `ioredis`.

`src/infrastructure/queue/queue.module.ts` — registers `BullModule.forRootAsync` (reads `REDIS_URL`) and
`BullModule.registerQueue({ name: 'pipeline-execution' })`.

`src/infrastructure/queue/pipeline-execution.processor.ts` — `@Processor('pipeline-execution', { concurrency: N })`
(`N` from config, default 5). Job payload: `{ executionId: ExecutionId }`. On process:

1. Load the `Execution` (`GetExecutionByIdUseCase`); if missing, throw (job fails, BullMQ marks it failed).
2. Load its `Pipeline` (`GetPipelineByIdUseCase`).
3. `execution.updateExecutionStatus('RUNNING')`, persist via `UpdateExecutionUseCase`.
4. Walk steps with `pipeline.getCurrentStep(i)` / `pipeline.nextStep(i)`, calling the matching `StepExecutor` from
   the registry, threading the payload from one step's `StepResult.payload` to the next step's input.
5. On any `StepResult.status === 'FAILED'`: `pipeline.markFailed(i, reason)`, `execution.updateExecutionStatus('FAILED')`,
   persist both, stop.
6. On completing all steps: `pipeline.markCompleted()`, `execution.updateExecutionStatus('COMPLETED')`, persist both.
7. Every step transition also calls `LoggerPort.log(...)`.

## Presentation layer

New top-level `src/presentation/` folder, one subfolder per subsystem, each with its own NestJS `Module`.

### Integrations (`src/presentation/integrations/`)

- `integrations.controller.ts`:
  - `POST /integrations` — body: `{ name?, description?, steps }` (the request DTO mirrors `CreatePipelineDTO`)
    → `CreatePipelineUseCase` → emits `integration.created` → returns the created Pipeline as `Schema` JSON via
    `SchemaAdapter`.
  - `GET /integrations` → `GetAllPipelinesUseCase` → array of `Schema` JSON.
  - `GET /integrations/:id` → `GetPipelineByIdUseCase` → `Schema` JSON (404 via `PipelineNotFoundError` mapped
    by a Nest exception filter — see Error handling below).
  - `PATCH /integrations/:id` → `UpdatePipelineUseCase` → emits `integration.updated` → `Schema` JSON.
  - `DELETE /integrations/:id` → `DeletePipelineUseCase` → emits `integration.deleted` → `204`.
- `integrations.gateway.ts` (`@WebSocketGateway({ namespace: 'integrations' })`): message handlers
  `integration:create`, `integration:update`, `integration:delete`, `integration:getById`, `integration:getAll`
  calling the same use cases; and listens on the same `IntegrationEventsEmitter` to `server.emit(...)` the
  `integration.created/updated/deleted` broadcasts, so HTTP-driven mutations reach WS subscribers too.
- `integration-events.emitter.ts` — a small injectable wrapping Node's `EventEmitter` (or Nest's
  `EventEmitter2` — will confirm during planning whether `@nestjs/event-emitter` is added as a dependency or a
  bare `EventEmitter` suffices) that the controller and gateway both depend on.
- `SchemaAdapter` ([schema.ts](../../../src/adapters/schema.ts)) is refactored to stop instantiating use cases
  itself; it becomes a pure mapper: `toSchema(pipeline: Pipeline): Schema` and `toPipelineInput(schema: Schema):
  {name?, description?, steps}`. Orchestration (calling use cases) moves to the controller/gateway.

### Logger (`src/presentation/logs/`)

- `logs.controller.ts`: `POST /logs`, `GET /logs`, `GET /logs/:id`, `DELETE /logs/:id` over the new LogEntry use
  cases. (Primarily useful for inspection/debugging; the main writer is `MongoLoggerService` from the execution
  flow, not this controller.)

### Executions / Queue (`src/presentation/executions/`)

- `executions.controller.ts`:
  - `POST /executions` — body `{ pipelineId }` → `CreateExecutionUseCase` with `status: 'PENDING'`,
    `startedAt: new Date()` → enqueue `{ executionId }` on the `pipeline-execution` queue → return `202` with
    the created Execution.
  - `GET /executions` → `GetAllExecutionsUseCase`.
  - `GET /executions/:id` → `GetExecutionByIdUseCase` (used by clients to poll status).

## Error handling

A shared `DomainExceptionFilter` (`@Catch(DomainError)`) in `src/presentation/common/` maps `*NotFoundError` →
404, `InvalidPipelineError`/`InvalidStepTransitionError` → 400, and any other `DomainError` → 500 with its
`code` in the response body. Registered globally in `main.ts`.

## Wiring (app.module.ts)

- `ConfigModule.forRoot({ isGlobal: true })`
- `DatabaseModule` (Mongoose root)
- `QueueModule` (BullMQ root + the `pipeline-execution` queue)
- Feature modules: `StepModule`, `PipelineModule`, `ConnectorModule`, `ExecutionModule`, `LogEntryModule` — each
  declares its Mongoose feature (`MongooseModule.forFeature([...])`), binds the repository port to the Mongo
  implementation via a DI token (e.g. `{ provide: 'PipelineRepository', useClass: PipelineMongoRepository }`),
  and exports the token so presentation modules can inject use cases that need it.
- `IntegrationsModule`, `LogsModule`, `ExecutionsModule` (presentation) import the relevant feature modules and
  declare the controllers/gateways. Use cases are provided as regular injectables (`@Injectable()` added to each
  use case class, constructor-injecting the port via `@Inject('XRepository')`) rather than `new`'d inline, so
  Nest's DI container owns their lifecycle.

## Configuration

New `.env` keys: `MONGODB_URI`, `REDIS_URL`, `PIPELINE_EXECUTION_CONCURRENCY` (default `5`). Loaded via
`@nestjs/config`.

## Testing

- Unit tests (no DB/Redis): each new use case (LogEntry CRUD), each `StepExecutor`, `SchemaAdapter` mapping
  methods, and the `PipelineExecutionProcessor`'s step-walking logic (with a fake `StepExecutor` registry and
  fake repositories).
- Integration tests: `mongodb-memory-server` (new dev dependency) spins up an ephemeral Mongo for repository
  tests and controller e2e tests (`supertest`, already present). Queue processing tests use a fake/in-memory
  BullMQ substitute or mock the queue's `add()` and test the processor function directly, rather than requiring
  a real Redis in CI.

## Open questions for the implementation plan

- Whether to add `@nestjs/event-emitter` as a dependency for `IntegrationEventsEmitter`, or use a bare Node
  `EventEmitter` wrapped in an injectable (leaning bare `EventEmitter`, decided during planning if it complicates
  DI).
- Exact BullMQ job retry/backoff defaults (out of scope goals say no production tuning, but a sane default like
  3 attempts with fixed backoff is reasonable to set once).
