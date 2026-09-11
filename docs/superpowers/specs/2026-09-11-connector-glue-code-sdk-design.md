# Connector / Glue-Code SDK — Design

## Purpose

A schema-driven connector/integration SDK: each integration ("connector") is
defined by a `connector.config.json` (source, field mapping, destination,
auth) instead of bespoke code. Built to Clean Architecture — business rules
(pipeline orchestration, validation, config invariants) stay independent of
Fastify, BullMQ, Redis, and any specific source/destination technology, so
those can be replaced without touching the core.

## Non-goals (v1)

- No UI/dashboard for managing connectors.
- No multi-tenant auth/authorization model — single-process, trusted config.
- No dynamic hot-reload of connector configs (restart to pick up changes).
- No GraphQL/DB dispatcher implementations in v1 beyond the interfaces — only
  REST dispatcher is built out; GraphQL/DB are stubs proving the port shape.

## Repo layout

Single npm package (not a monorepo).

```
src/
  domain/
    Pipeline.ts            # ordered Step[] + run(ctx)
    Step.ts                # type: (ctx: PipelineContext) => Promise<PipelineContext>
    ConnectorConfig.ts      # validated config entity + invariants
    errors.ts              # ValidationError, TransformError, DispatchError
  application/
    ports/
      SourceAdapter.ts
      Transformer.ts
      Dispatcher.ts
      RetryQueue.ts
      Logger.ts
      Clock.ts
      ConfigLoader.ts
    use-cases/
      RunConnector.ts       # receive -> validate -> transform -> dispatch -> log
      RunConnectorInput.ts
      RunConnectorOutput.ts
  adapters/
    source/
      WebhookReceiver.ts    # driven by infra Fastify route, not self-hosting
      PollingSource.ts
      QueueConsumer.ts
    transform/
      JsonataTransformer.ts
      FunctionTransformer.ts
      TransformerRegistry.ts   # picks adapter by config.mapping.type
    dispatch/
      RestDispatcher.ts
      GraphqlDispatcher.ts   # stub in v1
      DbDispatcher.ts        # stub in v1
      DispatcherRegistry.ts  # picks adapter by config.destination.type
  infrastructure/
    http/
      server.ts             # Fastify bootstrap
      webhookController.ts  # HTTP <-> RunConnector translation
    queue/
      BullMqRetryQueue.ts   # implements RetryQueue: backoff + DLQ
    logging/
      StructuredLogger.ts   # implements Logger, JSON per execution
    config/
      ConfigLoader.ts       # loads + schema-validates connector.config.json
    composition-root.ts     # wires ports -> adapters, only place `new` happens
examples/
  demo-connector/
    connector.config.json   # webhook -> transform (jsonata) -> REST dispatch
    sample-payload.json
```

## Domain layer

- `Pipeline`: an ordered array of `Step` functions. `run(ctx)` folds steps
  left to right, each step returning a new context (or throwing a typed
  domain error). Pure, no I/O, no framework types.
- `Step`: `(ctx: PipelineContext) => Promise<PipelineContext>`. A pure async
  function; side effects only happen inside adapter implementations invoked
  through ports, never inline in domain code.
- `ConnectorConfig`: parsed + invariant-checked representation of
  `connector.config.json` (source type, mapping rules, destination type,
  auth type). Construction fails closed — an invalid config cannot produce a
  `ConnectorConfig` instance.
- Typed errors: `ValidationError`, `TransformError`, `DispatchError` — carry
  enough detail for logging and for the use case's retry-eligibility
  decision, but carry no HTTP/queue-specific fields.

## Application layer

- Ports (interfaces owned here, implemented in `adapters/`/`infrastructure/`):
  `SourceAdapter`, `Transformer`, `Dispatcher`, `RetryQueue`, `Logger`,
  `Clock`, `ConfigLoader`.
- `RunConnector` use case: given `RunConnectorInput` (connector id + raw
  payload), loads the `ConnectorConfig` via `ConfigLoader`, resolves the
  `Transformer`/`Dispatcher` implementations via the composition root's
  registries, builds and runs the `Pipeline`, and returns
  `RunConnectorOutput` (success + dispatched response, or a structured
  failure). On adapter failure it classifies retry-eligible vs terminal
  errors and calls `RetryQueue.enqueue(...)` — it never imports BullMQ.
  Every run — success or failure — is logged once via the `Logger` port.

## Adapters layer

- `source/`: `WebhookReceiver` is a data holder / translator invoked by the
  Fastify controller — it does not open a listening socket itself.
  `PollingSource` and `QueueConsumer` are stubs in v1 (interface + no-op
  implementation) proving the port is source-technology-agnostic.
- `transform/`: `JsonataTransformer` (expression per config), `FunctionTransformer`
  (looks up a registered JS function by name from a small in-process
  registry). `TransformerRegistry` picks the right one from
  `config.mapping.type` — no branching inside the use case.
- `dispatch/`: `RestDispatcher` fully implemented (HTTP call with configured
  auth). `GraphqlDispatcher`/`DbDispatcher` are stubs. `DispatcherRegistry`
  picks by `config.destination.type`.

## Infrastructure layer

- `http/server.ts`: Fastify bootstrap; `webhookController.ts` parses the
  incoming HTTP request into `RunConnectorInput`, calls `RunConnector`, maps
  `RunConnectorOutput`/errors to an HTTP response. All HTTP-specific
  knowledge (status codes, headers) lives here only.
- `queue/BullMqRetryQueue.ts`: implements `RetryQueue` — exponential backoff
  retry + dead-letter queue on exhaustion, backed by Redis via BullMQ.
- `logging/StructuredLogger.ts`: implements `Logger` — one structured JSON
  record per pipeline execution (request, response, error if any).
- `config/ConfigLoader.ts`: reads `connector.config.json`/YAML from disk,
  validates against a schema, produces a `ConnectorConfig`.
- `composition-root.ts`: the only file that instantiates concrete adapters
  and wires them into the use case. Nothing inward of this file knows these
  concrete types exist.

## Data flow (webhook → REST example)

1. Fastify route receives HTTP POST → `webhookController` builds
   `RunConnectorInput`.
2. `RunConnector.execute(input)`:
   a. `ConfigLoader.load(connectorId)` → `ConnectorConfig`.
   b. validate raw payload against config's expected shape → `ValidationError`
      on failure (terminal, logged, 400 to caller).
   c. `TransformerRegistry.resolve(config.mapping)` → transform payload.
   d. `DispatcherRegistry.resolve(config.destination)` → dispatch.
   e. on dispatcher failure: classify (network/5xx = retry-eligible) →
      `RetryQueue.enqueue(job)`; else `DispatchError` terminal.
   f. `Logger.log(executionRecord)` always runs, success or failure.
3. Controller maps `RunConnectorOutput` to HTTP response.
4. `BullMqRetryQueue` retries with exponential backoff; after max attempts,
   job moves to the dead-letter queue and gets logged as exhausted.

## Error handling

Errors are typed in the domain (`ValidationError`, `TransformError`,
`DispatchError`) and flow up through the use case unmodified. The use case
decides retry-eligibility (a `DispatchError` from a 5xx/network failure is
retry-eligible; a `ValidationError` or 4xx `DispatchError` is terminal).
Translation to transport-specific shapes (HTTP status, BullMQ job data) only
happens in `infrastructure/`.

## Testing strategy

- **Core (fast, no I/O)**: `Pipeline`, `ConnectorConfig`, `RunConnector` use
  case tested with in-memory fakes for every port (`FakeTransformer`,
  `FakeDispatcher`, `FakeRetryQueue`, `FakeLogger`). No Fastify, no Redis, no
  network. This suite is the primary regression net and must stay fast.
- **Adapter tests**: `JsonataTransformer`/`FunctionTransformer` mapping
  correctness in isolation; `RestDispatcher` request-shaping (mocked HTTP);
  `webhookController` request/response translation (Fastify inject, no real
  server).
- **Integration (slow, separate suite)**: one end-to-end run of
  `examples/demo-connector` through real Fastify + real BullMQ/Redis (or
  testcontainers), proving the wiring in `composition-root.ts` is correct.
  Not part of the default fast test run.

## Stack

Node.js + TypeScript (strict), Fastify (webhook receiver), BullMQ + Redis
(retry/DLQ), JSONata (declarative transform option), Vitest (or Jest) for
tests.

## Example connector

`examples/demo-connector/connector.config.json`: webhook source → JSONata
mapping → REST dispatch, with a sample payload — demonstrates the whole
pitch (new integration = new config file, not new code).
