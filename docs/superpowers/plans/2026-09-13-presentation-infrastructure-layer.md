# Presentation + Infrastructure Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MongoDB-backed persistence, a BullMQ execution queue, and a NestJS presentation layer (HTTP + WebSocket) exposing Integrations CRUD, Logger CRUD, and queued pipeline execution.

**Architecture:** Retrofit existing application-layer use cases for NestJS DI (Symbol tokens), implement each repository port against MongoDB via `@nestjs/mongoose`, add a `LogEntry` entity/port for logging, build `StepExecutor` strategies per `StepKind`, drive them from a BullMQ `Processor`, and expose everything through thin controllers/gateways in a new `src/presentation/` layer.

**Tech Stack:** NestJS 11, `@nestjs/mongoose` + `mongoose`, `@nestjs/websockets` + `socket.io`, `@nestjs/bullmq` + `bullmq` + `ioredis`, `@nestjs/config`, Jest + `mongodb-memory-server` for tests.

**Spec:** [docs/superpowers/specs/2026-09-13-presentation-infrastructure-layer-design.md](../specs/2026-09-13-presentation-infrastructure-layer-design.md)

## Global Constraints

- Dependencies point inward: domain/application code never imports Mongoose, `@nestjs/websockets`, `bullmq`, or any other framework/infra type.
- Every repository port implementation lives under `src/infrastructure/`; every wire-facing controller/gateway lives under `src/presentation/`.
- All use cases become `@Injectable()` classes constructor-injecting ports via `@Inject(<TOKEN>)`, where `<TOKEN>` is a `Symbol` defined once in `src/application/tokens.ts`.
- No authentication/authorization, no production-grade queue tuning, no full JSON Schema library — per spec Non-goals.
- `@/*` maps to `src/*` (see [tsconfig.json](../../../tsconfig.json)); tests must be able to resolve it too (Task 1 fixes this for Jest).
- Every new/modified file follows the existing single-quote, no-semicolon-omission Prettier style already applied to the repo (see any file under `src/application/use-cases/`).

---

### Task 1: Foundation — dependencies & Jest path-alias resolution

**Files:**
- Modify: `package.json`
- Modify: `test/jest-e2e.json`
- Create: `.env.example`

**Interfaces:**
- Produces: working `@/...` imports inside Jest-run tests (both unit and e2e configs), and all packages later tasks depend on.

- [ ] **Step 1: Install runtime dependencies**

Run:
```bash
npm install @nestjs/config @nestjs/mongoose mongoose @nestjs/websockets @nestjs/platform-socket.io socket.io @nestjs/bullmq bullmq ioredis
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D mongodb-memory-server socket.io-client
```

- [ ] **Step 3: Add Jest path-alias resolution**

In `package.json`, add `moduleNameMapper` to the existing `"jest"` block (rootDir is `"src"` there, so the mapper points at the sibling paths):

```json
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/$1"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  },
```

In `test/jest-e2e.json` (rootDir is `"."` there, so the mapper points into `src`):

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
}
```

- [ ] **Step 4: Create `.env.example`**

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/gluecode
REDIS_URL=redis://localhost:6379
PIPELINE_EXECUTION_CONCURRENCY=5
```

- [ ] **Step 5: Verify nothing broke**

Run: `npm test`
Expected: PASS (existing `app.controller.spec.ts` still passes).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json test/jest-e2e.json .env.example
git commit -m "chore: add mongo/websocket/queue deps and jest path-alias resolution"
```

---

### Task 2: Application-layer DI tokens

**Files:**
- Create: `src/application/tokens.ts`
- Test: `src/application/tokens.spec.ts`

**Interfaces:**
- Produces: `STEP_REPOSITORY`, `PIPELINE_REPOSITORY`, `CONNECTOR_REPOSITORY`, `EXECUTION_REPOSITORY`, `LOG_ENTRY_REPOSITORY`, `LOGGER_PORT`, `STEP_EXECUTOR_REGISTRY` (all `symbol`), `PIPELINE_EXECUTION_QUEUE` (`string` literal `'pipeline-execution'`) — every later task imports these instead of redefining tokens.

- [ ] **Step 1: Write the failing test**

```ts
// src/application/tokens.spec.ts
import {
  STEP_REPOSITORY,
  PIPELINE_REPOSITORY,
  CONNECTOR_REPOSITORY,
  EXECUTION_REPOSITORY,
  LOG_ENTRY_REPOSITORY,
  LOGGER_PORT,
  STEP_EXECUTOR_REGISTRY,
  PIPELINE_EXECUTION_QUEUE,
} from './tokens';

describe('application tokens', () => {
  it('are all unique values', () => {
    const symbolTokens = [
      STEP_REPOSITORY,
      PIPELINE_REPOSITORY,
      CONNECTOR_REPOSITORY,
      EXECUTION_REPOSITORY,
      LOG_ENTRY_REPOSITORY,
      LOGGER_PORT,
      STEP_EXECUTOR_REGISTRY,
    ];
    expect(new Set(symbolTokens).size).toBe(symbolTokens.length);
    expect(typeof PIPELINE_EXECUTION_QUEUE).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tokens.spec.ts`
Expected: FAIL with "Cannot find module './tokens'"

- [ ] **Step 3: Write the implementation**

```ts
// src/application/tokens.ts
export const STEP_REPOSITORY = Symbol('StepRepository');
export const PIPELINE_REPOSITORY = Symbol('PipelineRepository');
export const CONNECTOR_REPOSITORY = Symbol('ConnectorRepository');
export const EXECUTION_REPOSITORY = Symbol('ExecutionRepository');
export const LOG_ENTRY_REPOSITORY = Symbol('LogEntryRepository');
export const LOGGER_PORT = Symbol('LoggerPort');
export const STEP_EXECUTOR_REGISTRY = Symbol('StepExecutorRegistry');

export const PIPELINE_EXECUTION_QUEUE = 'pipeline-execution';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tokens.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/tokens.ts src/application/tokens.spec.ts
git commit -m "feat: add application-layer DI tokens"
```

---

### Task 3: Step use cases become injectable

**Files:**
- Modify: `src/application/use-cases/step/create-step.use-case.ts`
- Modify: `src/application/use-cases/step/update-step.use-case.ts`
- Modify: `src/application/use-cases/step/delete-step.use-case.ts`
- Modify: `src/application/use-cases/step/get-step-by-id.use-case.ts`
- Modify: `src/application/use-cases/step/get-all-steps.use-case.ts`
- Test: `src/application/use-cases/step/create-step.use-case.spec.ts`
- Test: `src/application/use-cases/step/delete-step.use-case.spec.ts`

**Interfaces:**
- Consumes: `STEP_REPOSITORY` token from `@/application/tokens` (Task 2).
- Produces: `CreateStepUseCase`, `UpdateStepUseCase`, `DeleteStepUseCase`, `GetStepByIdUseCase`, `GetAllStepsUseCase` as `@Injectable()` classes resolvable by Nest via `STEP_REPOSITORY`. No behavior change vs. current implementation.

- [ ] **Step 1: Write the failing tests**

```ts
// src/application/use-cases/step/create-step.use-case.spec.ts
import { StepKind } from '@/@types/enums';
import { StepRepository } from '@/application/repositories/step.repository';
import { CreateStepUseCase } from './create-step.use-case';

describe('CreateStepUseCase', () => {
  it('builds a Step and delegates to the repository', async () => {
    const repository: jest.Mocked<StepRepository> = {
      createStep: jest.fn().mockResolvedValue(true),
      updateStep: jest.fn(),
      deleteStep: jest.fn(),
      existsById: jest.fn(),
      getAllSteps: jest.fn(),
    };
    const useCase = new CreateStepUseCase(repository);

    const created = await useCase.execute({
      kind: StepKind.LOG,
      config: { kind: StepKind.LOG, level: 'info' },
    });

    expect(created).toBe(true);
    expect(repository.createStep).toHaveBeenCalledTimes(1);
    const [step] = repository.createStep.mock.calls[0];
    expect(step.kind).toBe(StepKind.LOG);
  });
});
```

```ts
// src/application/use-cases/step/delete-step.use-case.spec.ts
import { StepKind } from '@/@types/enums';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { StepNotFoundError } from '@/shared/errors/domain';
import { DeleteStepUseCase } from './delete-step.use-case';

describe('DeleteStepUseCase', () => {
  it('throws StepNotFoundError when the step does not exist', async () => {
    const repository: jest.Mocked<StepRepository> = {
      createStep: jest.fn(),
      updateStep: jest.fn(),
      deleteStep: jest.fn(),
      existsById: jest.fn().mockResolvedValue(null),
      getAllSteps: jest.fn(),
    };
    const useCase = new DeleteStepUseCase(repository);

    await expect(useCase.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      StepNotFoundError,
    );
  });

  it('deletes an existing step', async () => {
    const existing = new Step('s1', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'info',
    });
    const repository: jest.Mocked<StepRepository> = {
      createStep: jest.fn(),
      updateStep: jest.fn(),
      deleteStep: jest.fn().mockResolvedValue(true),
      existsById: jest.fn().mockResolvedValue(existing),
      getAllSteps: jest.fn(),
    };
    const useCase = new DeleteStepUseCase(repository);

    const result = await useCase.execute({ id: 's1' });

    expect(result).toBe(true);
    expect(repository.deleteStep).toHaveBeenCalledWith(existing);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- step/create-step.use-case.spec.ts step/delete-step.use-case.spec.ts`
Expected: FAIL (current use cases still compile and pass logically — these tests are expected to already pass since no behavior changes; if they pass immediately, proceed straight to Step 3's decorator-only edit and re-run to confirm still green. The point of this task is the decorator retrofit, not new behavior.)

- [ ] **Step 3: Add `@Injectable()`/`@Inject` to each use case**

```ts
// src/application/use-cases/step/create-step.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { StepConfig } from '@/@types/domain';
import { CreateStepDTO } from '@/application/dtos/step/create-step.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';
import { generateID } from '@/infrastructure/utils/StringUtils';

@Injectable()
export class CreateStepUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: CreateStepDTO): Promise<boolean> {
    const { kind, config } = request;

    const id = generateID();

    const step = new Step(id, kind, config as unknown as StepConfig);

    const created = await this.stepRepository.createStep(step);

    return created;
  }
}
```

```ts
// src/application/use-cases/step/update-step.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { UpdateStepDTO } from '@/application/dtos/step/update-step.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';

@Injectable()
export class UpdateStepUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: UpdateStepDTO): Promise<Step | null> {
    const { id, kind, config } = request;

    const step = new Step(id, kind, config);

    const updated = await this.stepRepository.updateStep(step);

    return updated;
  }
}
```

```ts
// src/application/use-cases/step/delete-step.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { DeleteStepDTO } from '@/application/dtos/step/delete-step.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { StepNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteStepUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: DeleteStepDTO): Promise<boolean> {
    const { id } = request;

    const existingStep = await this.stepRepository.existsById(id);

    if (!existingStep) {
      throw new StepNotFoundError(`Step with id ${id} was not found.`);
    }

    const deleted = await this.stepRepository.deleteStep(existingStep);

    return deleted;
  }
}
```

```ts
// src/application/use-cases/step/get-step-by-id.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { GetStepByIdDTO } from '@/application/dtos/step/get-step-by-id.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';

@Injectable()
export class GetStepByIdUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: GetStepByIdDTO): Promise<Step | null> {
    const { id } = request;

    const step = await this.stepRepository.existsById(id);

    return step;
  }
}
```

```ts
// src/application/use-cases/step/get-all-steps.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';

@Injectable()
export class GetAllStepsUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(): Promise<Step[]> {
    const steps = await this.stepRepository.getAllSteps();

    return steps;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- step/create-step.use-case.spec.ts step/delete-step.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/step
git commit -m "feat: make Step use cases NestJS-injectable"
```

---

### Task 4: Pipeline entity metadata + injectable Pipeline use cases

**Files:**
- Modify: `src/domain/entities/pipeline.ts`
- Modify: `src/application/dtos/pipeline/create-pipeline.dto.ts`
- Modify: `src/application/dtos/pipeline/update-pipeline.dto.ts`
- Modify: `src/application/use-cases/pipeline/create-pipeline.use-case.ts`
- Modify: `src/application/use-cases/pipeline/update-pipeline.use-case.ts`
- Modify: `src/application/use-cases/pipeline/delete-pipeline.use-case.ts`
- Modify: `src/application/use-cases/pipeline/get-pipeline-by-id.use-case.ts`
- Modify: `src/application/use-cases/pipeline/get-all-pipelines.use-case.ts`
- Test: `src/domain/entities/pipeline.spec.ts`
- Test: `src/application/use-cases/pipeline/create-pipeline.use-case.spec.ts`

**Interfaces:**
- Consumes: `PIPELINE_REPOSITORY` token (Task 2).
- Produces: `Pipeline` with `name?: string`, `description?: string`, `getSteps(): Step[]`. `CreatePipelineUseCase.execute(dto): Promise<Pipeline | null>` (changed from `Promise<boolean>` — later tasks, notably the Integrations controller in Task 21, need the created entity back, not just a flag).

- [ ] **Step 1: Write the failing entity test**

```ts
// src/domain/entities/pipeline.spec.ts
import { StepKind, PipelineStatus } from '@/@types/enums';
import { Step } from './step';
import { Pipeline } from './pipeline';

describe('Pipeline', () => {
  const steps = [
    new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' }),
  ];

  it('carries optional name/description metadata', () => {
    const pipeline = new Pipeline(
      'p1',
      steps,
      PipelineStatus.IDLE,
      'My Pipeline',
      'A description',
    );

    expect(pipeline.name).toBe('My Pipeline');
    expect(pipeline.description).toBe('A description');
  });

  it('exposes a copy of its steps via getSteps()', () => {
    const pipeline = new Pipeline('p1', steps, PipelineStatus.IDLE);

    const returned = pipeline.getSteps();

    expect(returned).toEqual(steps);
    expect(returned).not.toBe(steps);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- domain/entities/pipeline.spec.ts`
Expected: FAIL with "Property 'name' does not exist" / "getSteps is not a function"

- [ ] **Step 3: Update the Pipeline entity**

```ts
// src/domain/entities/pipeline.ts
import { PipelineId } from '@/@types/IDs';
import { Step } from './step';
import { PipelineStatus } from '@/@types/enums';
import { InvalidPipelineError } from '@/shared/errors/domain';
import { Entity } from '@/base/entity';

export class Pipeline extends Entity {
  constructor(
    public readonly id: PipelineId,
    private readonly steps: Step[],
    public status: PipelineStatus = PipelineStatus.IDLE,
    public name?: string,
    public description?: string,
  ) {
    if (steps.length === 0)
      throw new InvalidPipelineError('A pipeline must have at least one step.');
    super();
  }

  getSteps(): Step[] {
    return [...this.steps];
  }

  nextStep(currentIndex: number): Step | null {
    return this.steps[currentIndex + 1] ?? null;
  }

  markFailed(atStep: number, reason: string): void {
    console.error(`Pipeline ${this.id} failed at step ${atStep}: ${reason}`);
    this.status = PipelineStatus.FAILED;
    this.steps.slice(atStep).forEach((step) => {
      console.log(`Marking step ${step.id} as failed.`);
    });
  }

  markCompleted(): void {
    console.log(`Pipeline ${this.id} completed successfully.`);
    this.status = PipelineStatus.COMPLETED;
  }

  getCurrentStatus(): PipelineStatus {
    return this.status;
  }

  getCurrentStep(index: number): Step | null {
    if (index < 0 || index >= this.steps.length) {
      console.warn(`Invalid step index ${index} for pipeline ${this.id}.`);
      return null;
    }
    return this.steps[index];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- domain/entities/pipeline.spec.ts`
Expected: PASS

- [ ] **Step 5: Update Pipeline DTOs**

```ts
// src/application/dtos/pipeline/create-pipeline.dto.ts
import { PipelineStatus } from '@/@types/enums';
import { Step } from '@/domain/entities/step';

export interface CreatePipelineDTO {
  steps: Step[];
  status?: PipelineStatus;
  name?: string;
  description?: string;
}
```

```ts
// src/application/dtos/pipeline/update-pipeline.dto.ts
import { PipelineStatus } from '@/@types/enums';
import { PipelineId } from '@/@types/IDs';
import { Step } from '@/domain/entities/step';

export interface UpdatePipelineDTO {
  id: PipelineId;
  steps: Step[];
  status?: PipelineStatus;
  name?: string;
  description?: string;
}
```

- [ ] **Step 6: Write the failing use-case test**

```ts
// src/application/use-cases/pipeline/create-pipeline.use-case.spec.ts
import { StepKind, PipelineStatus } from '@/@types/enums';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Step } from '@/domain/entities/step';
import { CreatePipelineUseCase } from './create-pipeline.use-case';

describe('CreatePipelineUseCase', () => {
  it('returns the created Pipeline entity', async () => {
    const repository: jest.Mocked<PipelineRepository> = {
      createPipeline: jest.fn().mockResolvedValue(true),
      updatePipeline: jest.fn(),
      deletePipeline: jest.fn(),
      existsById: jest.fn(),
      getAllPipelines: jest.fn(),
    };
    const useCase = new CreatePipelineUseCase(repository);
    const steps = [
      new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' }),
    ];

    const pipeline = await useCase.execute({
      steps,
      status: PipelineStatus.IDLE,
      name: 'My Pipeline',
    });

    expect(pipeline).not.toBeNull();
    expect(pipeline?.name).toBe('My Pipeline');
    expect(repository.createPipeline).toHaveBeenCalledWith(pipeline);
  });

  it('returns null when the repository reports failure', async () => {
    const repository: jest.Mocked<PipelineRepository> = {
      createPipeline: jest.fn().mockResolvedValue(false),
      updatePipeline: jest.fn(),
      deletePipeline: jest.fn(),
      existsById: jest.fn(),
      getAllPipelines: jest.fn(),
    };
    const useCase = new CreatePipelineUseCase(repository);
    const steps = [
      new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' }),
    ];

    const pipeline = await useCase.execute({ steps });

    expect(pipeline).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- pipeline/create-pipeline.use-case.spec.ts`
Expected: FAIL (current `execute` returns `boolean`, not `Pipeline | null`)

- [ ] **Step 8: Update Pipeline use cases**

```ts
// src/application/use-cases/pipeline/create-pipeline.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { CreatePipelineDTO } from '@/application/dtos/pipeline/create-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';
import { generateID } from '@/infrastructure/utils/StringUtils';

@Injectable()
export class CreatePipelineUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: CreatePipelineDTO): Promise<Pipeline | null> {
    const { steps, status, name, description } = request;

    const id = generateID();

    const pipeline = new Pipeline(id, steps, status, name, description);

    const created = await this.pipelineRepository.createPipeline(pipeline);

    return created ? pipeline : null;
  }
}
```

```ts
// src/application/use-cases/pipeline/update-pipeline.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { UpdatePipelineDTO } from '@/application/dtos/pipeline/update-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';

@Injectable()
export class UpdatePipelineUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: UpdatePipelineDTO): Promise<Pipeline | null> {
    const { id, steps, status, name, description } = request;

    const pipeline = new Pipeline(id, steps, status, name, description);

    const updated = await this.pipelineRepository.updatePipeline(pipeline);

    return updated;
  }
}
```

```ts
// src/application/use-cases/pipeline/delete-pipeline.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { DeletePipelineDTO } from '@/application/dtos/pipeline/delete-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { PipelineNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeletePipelineUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: DeletePipelineDTO): Promise<boolean> {
    const { id } = request;

    const existingPipeline = await this.pipelineRepository.existsById(id);

    if (!existingPipeline) {
      throw new PipelineNotFoundError(`Pipeline with id ${id} was not found.`);
    }

    const deleted =
      await this.pipelineRepository.deletePipeline(existingPipeline);

    return deleted;
  }
}
```

```ts
// src/application/use-cases/pipeline/get-pipeline-by-id.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { GetPipelineByIdDTO } from '@/application/dtos/pipeline/get-pipeline-by-id.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';

@Injectable()
export class GetPipelineByIdUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: GetPipelineByIdDTO): Promise<Pipeline | null> {
    const { id } = request;

    const pipeline = await this.pipelineRepository.existsById(id);

    return pipeline;
  }
}
```

```ts
// src/application/use-cases/pipeline/get-all-pipelines.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';

@Injectable()
export class GetAllPipelinesUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(): Promise<Pipeline[]> {
    const pipelines = await this.pipelineRepository.getAllPipelines();

    return pipelines;
  }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test -- pipeline`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/domain/entities/pipeline.ts src/domain/entities/pipeline.spec.ts src/application/dtos/pipeline src/application/use-cases/pipeline
git commit -m "feat: add Pipeline metadata fields and make Pipeline use cases injectable"
```

---

### Task 5: Connector use cases become injectable

**Files:**
- Modify: `src/application/use-cases/connector/create-connector.use-case.ts`
- Modify: `src/application/use-cases/connector/update-connector.use-case.ts`
- Modify: `src/application/use-cases/connector/delete-connector.use-case.ts`
- Modify: `src/application/use-cases/connector/get-connector-by-id.use-case.ts`
- Modify: `src/application/use-cases/connector/get-all-connectors.use-case.ts`
- Test: `src/application/use-cases/connector/delete-connector.use-case.spec.ts`

**Interfaces:**
- Consumes: `CONNECTOR_REPOSITORY` token (Task 2).
- Produces: all five Connector use cases as `@Injectable()` classes. No behavior change.

- [ ] **Step 1: Write the failing test**

```ts
// src/application/use-cases/connector/delete-connector.use-case.spec.ts
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { ConnectorNotFoundError } from '@/shared/errors/domain';
import { DeleteConnectorUseCase } from './delete-connector.use-case';

const buildConnector = () =>
  new Connector(
    'c1',
    { url: 'https://source.test', method: 'GET' },
    {},
    [],
    { url: 'https://dest.test', method: 'POST' },
    { type: 'none' },
  );

describe('DeleteConnectorUseCase', () => {
  it('throws ConnectorNotFoundError when missing', async () => {
    const repository: jest.Mocked<ConnectorRepository> = {
      createConnector: jest.fn(),
      updateConnector: jest.fn(),
      deleteConnector: jest.fn(),
      existsById: jest.fn().mockResolvedValue(null),
      getAllConnectors: jest.fn(),
    };
    const useCase = new DeleteConnectorUseCase(repository);

    await expect(useCase.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      ConnectorNotFoundError,
    );
  });

  it('deletes an existing connector', async () => {
    const existing = buildConnector();
    const repository: jest.Mocked<ConnectorRepository> = {
      createConnector: jest.fn(),
      updateConnector: jest.fn(),
      deleteConnector: jest.fn().mockResolvedValue(true),
      existsById: jest.fn().mockResolvedValue(existing),
      getAllConnectors: jest.fn(),
    };
    const useCase = new DeleteConnectorUseCase(repository);

    const result = await useCase.execute({ id: 'c1' });

    expect(result).toBe(true);
    expect(repository.deleteConnector).toHaveBeenCalledWith(existing);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- connector/delete-connector.use-case.spec.ts`
Expected: FAIL only if the constructor signature already changed; otherwise this test documents current behavior and should pass once the decorator-only edit lands — run once before Step 3 to confirm the starting point compiles.

- [ ] **Step 3: Add `@Injectable()`/`@Inject` to each Connector use case**

```ts
// src/application/use-cases/connector/create-connector.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { CreateConnectorDTO } from '@/application/dtos/connector/create-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';
import { generateID } from '@/infrastructure/utils/StringUtils';

@Injectable()
export class CreateConnectorUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(request: CreateConnectorDTO): Promise<boolean> {
    const { source, schema, mapping, destination, auth } = request;

    const id = generateID();

    const connector = new Connector(
      id,
      source,
      schema,
      mapping,
      destination,
      auth,
    );

    const created = await this.connectorRepository.createConnector(connector);

    return created;
  }
}
```

```ts
// src/application/use-cases/connector/update-connector.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { UpdateConnectorDTO } from '@/application/dtos/connector/update-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';

@Injectable()
export class UpdateConnectorUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(request: UpdateConnectorDTO): Promise<Connector | null> {
    const { id, source, schema, mapping, destination, auth } = request;

    const connector = new Connector(
      id,
      source,
      schema,
      mapping,
      destination,
      auth,
    );

    const updated = await this.connectorRepository.updateConnector(connector);

    return updated;
  }
}
```

```ts
// src/application/use-cases/connector/delete-connector.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { DeleteConnectorDTO } from '@/application/dtos/connector/delete-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { ConnectorNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteConnectorUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(request: DeleteConnectorDTO): Promise<boolean> {
    const { id } = request;

    const existingConnector = await this.connectorRepository.existsById(id);

    if (!existingConnector) {
      throw new ConnectorNotFoundError(
        `Connector with id ${id} was not found.`,
      );
    }

    const deleted =
      await this.connectorRepository.deleteConnector(existingConnector);

    return deleted;
  }
}
```

```ts
// src/application/use-cases/connector/get-connector-by-id.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { GetConnectorByIdDTO } from '@/application/dtos/connector/get-connector-by-id.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';

@Injectable()
export class GetConnectorByIdUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(
    request: GetConnectorByIdDTO,
  ): Promise<Connector | null> {
    const { id } = request;

    const connector = await this.connectorRepository.existsById(id);

    return connector;
  }
}
```

```ts
// src/application/use-cases/connector/get-all-connectors.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';

@Injectable()
export class GetAllConnectorsUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(): Promise<Connector[]> {
    const connectors = await this.connectorRepository.getAllConnectors();

    return connectors;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- connector/delete-connector.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/connector
git commit -m "feat: make Connector use cases NestJS-injectable"
```

---

### Task 6: Execution use cases become injectable, CreateExecutionUseCase returns the entity

**Files:**
- Modify: `src/application/use-cases/execution/create-execution.use-case.ts`
- Modify: `src/application/use-cases/execution/update-execution.use-case.ts`
- Modify: `src/application/use-cases/execution/delete-execution.use-case.ts`
- Modify: `src/application/use-cases/execution/get-execution-by-id.use-case.ts`
- Modify: `src/application/use-cases/execution/get-all-executions.use-case.ts`
- Test: `src/application/use-cases/execution/create-execution.use-case.spec.ts`

**Interfaces:**
- Consumes: `EXECUTION_REPOSITORY` token (Task 2).
- Produces: `CreateExecutionUseCase.execute(dto): Promise<Execution | null>` (changed from `Promise<boolean>` — Task 24's `ExecutionsController` needs the created execution's `id` to enqueue a job and to return it in the response body).

- [ ] **Step 1: Write the failing test**

```ts
// src/application/use-cases/execution/create-execution.use-case.spec.ts
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { CreateExecutionUseCase } from './create-execution.use-case';

describe('CreateExecutionUseCase', () => {
  it('returns the created Execution entity', async () => {
    const repository: jest.Mocked<ExecutionRepository> = {
      createExecution: jest.fn().mockResolvedValue(true),
      updateExecution: jest.fn(),
      deleteExecution: jest.fn(),
      existsById: jest.fn(),
      getAllExecutions: jest.fn(),
    };
    const useCase = new CreateExecutionUseCase(repository);
    const startedAt = new Date('2026-01-01T00:00:00.000Z');

    const execution = await useCase.execute({
      pipelineId: 'p1',
      status: 'PENDING',
      startedAt,
    });

    expect(execution).not.toBeNull();
    expect(execution?.pipelineId).toBe('p1');
    expect(execution?.status).toBe('PENDING');
    expect(repository.createExecution).toHaveBeenCalledWith(execution);
  });

  it('returns null when the repository reports failure', async () => {
    const repository: jest.Mocked<ExecutionRepository> = {
      createExecution: jest.fn().mockResolvedValue(false),
      updateExecution: jest.fn(),
      deleteExecution: jest.fn(),
      existsById: jest.fn(),
      getAllExecutions: jest.fn(),
    };
    const useCase = new CreateExecutionUseCase(repository);

    const execution = await useCase.execute({
      pipelineId: 'p1',
      status: 'PENDING',
      startedAt: new Date(),
    });

    expect(execution).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- execution/create-execution.use-case.spec.ts`
Expected: FAIL (current `execute` returns `boolean`)

- [ ] **Step 3: Update Execution use cases**

```ts
// src/application/use-cases/execution/create-execution.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { CreateExecutionDTO } from '@/application/dtos/execution/create-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';
import { generateID } from '@/infrastructure/utils/StringUtils';

@Injectable()
export class CreateExecutionUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(request: CreateExecutionDTO): Promise<Execution | null> {
    const { pipelineId, status, startedAt, completedAt } = request;

    const id = generateID();

    const execution = new Execution(
      id,
      pipelineId,
      status,
      startedAt,
      completedAt,
    );

    const created = await this.executionRepository.createExecution(execution);

    return created ? execution : null;
  }
}
```

```ts
// src/application/use-cases/execution/update-execution.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { UpdateExecutionDTO } from '@/application/dtos/execution/update-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

@Injectable()
export class UpdateExecutionUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(request: UpdateExecutionDTO): Promise<Execution | null> {
    const { id, pipelineId, status, startedAt, completedAt } = request;

    const execution = new Execution(
      id,
      pipelineId,
      status,
      startedAt,
      completedAt,
    );

    const updated = await this.executionRepository.updateExecution(execution);

    return updated;
  }
}
```

```ts
// src/application/use-cases/execution/delete-execution.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { DeleteExecutionDTO } from '@/application/dtos/execution/delete-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { ExecutionNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteExecutionUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(request: DeleteExecutionDTO): Promise<boolean> {
    const { id } = request;

    const existingExecution = await this.executionRepository.existsById(id);

    if (!existingExecution) {
      throw new ExecutionNotFoundError(
        `Execution with id ${id} was not found.`,
      );
    }

    const deleted =
      await this.executionRepository.deleteExecution(existingExecution);

    return deleted;
  }
}
```

```ts
// src/application/use-cases/execution/get-execution-by-id.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { GetExecutionByIdDTO } from '@/application/dtos/execution/get-execution-by-id.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

@Injectable()
export class GetExecutionByIdUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(
    request: GetExecutionByIdDTO,
  ): Promise<Execution | null> {
    const { id } = request;

    const execution = await this.executionRepository.existsById(id);

    return execution;
  }
}
```

```ts
// src/application/use-cases/execution/get-all-executions.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

@Injectable()
export class GetAllExecutionsUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(): Promise<Execution[]> {
    const executions = await this.executionRepository.getAllExecutions();

    return executions;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- execution/create-execution.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/execution
git commit -m "feat: make Execution use cases injectable, CreateExecutionUseCase returns the entity"
```

---

### Task 7: LogEntry domain entity, repository port, DTOs, and injectable use cases

**Files:**
- Modify: `src/@types/IDs.ts`
- Modify: `src/shared/errors/domain.ts`
- Create: `src/domain/entities/log-entry.ts`
- Create: `src/application/repositories/log-entry.repository.ts`
- Create: `src/application/dtos/log-entry/create-log-entry.dto.ts`
- Create: `src/application/dtos/log-entry/delete-log-entry.dto.ts`
- Create: `src/application/dtos/log-entry/get-log-entry-by-id.dto.ts`
- Create: `src/application/use-cases/log-entry/create-log-entry.use-case.ts`
- Create: `src/application/use-cases/log-entry/delete-log-entry.use-case.ts`
- Create: `src/application/use-cases/log-entry/get-log-entry-by-id.use-case.ts`
- Create: `src/application/use-cases/log-entry/get-all-log-entries.use-case.ts`
- Test: `src/domain/entities/log-entry.spec.ts`
- Test: `src/application/use-cases/log-entry/create-log-entry.use-case.spec.ts`
- Test: `src/application/use-cases/log-entry/delete-log-entry.use-case.spec.ts`

**Interfaces:**
- Consumes: `LOG_ENTRY_REPOSITORY` token (Task 2).
- Produces: `LogEntry` entity, `LogLevel` type, `LogEntryId` type, `LogEntryRepository` port (`createLogEntry`, `deleteLogEntry`, `existsById`, `getAllLogEntries` — no update, log entries are immutable), `LogEntryNotFoundError`, and four injectable use cases (`CreateLogEntryUseCase`, `DeleteLogEntryUseCase`, `GetLogEntryByIdUseCase`, `GetAllLogEntriesUseCase`) that Task 13 (Mongo repo), Task 13 (`MongoLoggerService`), and Task 23 (`LogsController`) all depend on.

- [ ] **Step 1: Write the failing entity test**

```ts
// src/domain/entities/log-entry.spec.ts
import { LogEntry } from './log-entry';

describe('LogEntry', () => {
  it('holds level, message, optional context and executionId', () => {
    const entry = new LogEntry(
      'l1',
      'info',
      'Step executed',
      { stepId: 's1' },
      'e1',
    );

    expect(entry.id).toBe('l1');
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Step executed');
    expect(entry.context).toEqual({ stepId: 's1' });
    expect(entry.executionId).toBe('e1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- domain/entities/log-entry.spec.ts`
Expected: FAIL with "Cannot find module './log-entry'"

- [ ] **Step 3: Add `LogEntryId` and the `LogEntry` entity**

```ts
// src/@types/IDs.ts
export type PipelineId = string;
export type StepId = string;
export type ExecutionId = string;
export type ConnectorId = string;
export type LogEntryId = string;

export const PipelineId = (v: string): PipelineId => v;
export const StepId = (v: string): StepId => v;
export const ExecutionId = (v: string): ExecutionId => v;
export const ConnectorId = (v: string): ConnectorId => v;
export const LogEntryId = (v: string): LogEntryId => v;
```

```ts
// src/domain/entities/log-entry.ts
import { ExecutionId, LogEntryId } from '@/@types/IDs';
import { Entity } from '@/base/entity';

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- domain/entities/log-entry.spec.ts`
Expected: PASS

- [ ] **Step 5: Add `LogEntryNotFoundError`**

```ts
// src/shared/errors/domain.ts
import { DomainError } from '@/base/error';

export class InvalidPipelineError extends DomainError {
  readonly code = 'INVALID_PIPELINE';
}

export class InvalidStepTransitionError extends DomainError {
  readonly code = 'INVALID_STEP_TRANSITION';
}

export class StepNotFoundError extends DomainError {
  readonly code = 'STEP_NOT_FOUND';
}

export class PipelineNotFoundError extends DomainError {
  readonly code = 'PIPELINE_NOT_FOUND';
}

export class ConnectorNotFoundError extends DomainError {
  readonly code = 'CONNECTOR_NOT_FOUND';
}

export class ExecutionNotFoundError extends DomainError {
  readonly code = 'EXECUTION_NOT_FOUND';
}

export class LogEntryNotFoundError extends DomainError {
  readonly code = 'LOG_ENTRY_NOT_FOUND';
}
```

- [ ] **Step 6: Add the repository port**

```ts
// src/application/repositories/log-entry.repository.ts
import { LogEntry } from '@/domain/entities/log-entry';

export interface LogEntryRepository {
  createLogEntry(logEntry: LogEntry): Promise<boolean>;
  deleteLogEntry(logEntry: LogEntry): Promise<boolean>;
  existsById(logEntryId: string): Promise<LogEntry | null>;
  getAllLogEntries(): Promise<LogEntry[]>;
}
```

- [ ] **Step 7: Add the DTOs**

```ts
// src/application/dtos/log-entry/create-log-entry.dto.ts
import { ExecutionId } from '@/@types/IDs';
import { LogLevel } from '@/domain/entities/log-entry';

export interface CreateLogEntryDTO {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  executionId?: ExecutionId;
}
```

```ts
// src/application/dtos/log-entry/delete-log-entry.dto.ts
import { LogEntryId } from '@/@types/IDs';

export interface DeleteLogEntryDTO {
  id: LogEntryId;
}
```

```ts
// src/application/dtos/log-entry/get-log-entry-by-id.dto.ts
import { LogEntryId } from '@/@types/IDs';

export interface GetLogEntryByIdDTO {
  id: LogEntryId;
}
```

- [ ] **Step 8: Write the failing use-case tests**

```ts
// src/application/use-cases/log-entry/create-log-entry.use-case.spec.ts
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { CreateLogEntryUseCase } from './create-log-entry.use-case';

describe('CreateLogEntryUseCase', () => {
  it('builds a LogEntry and delegates to the repository', async () => {
    const repository: jest.Mocked<LogEntryRepository> = {
      createLogEntry: jest.fn().mockResolvedValue(true),
      deleteLogEntry: jest.fn(),
      existsById: jest.fn(),
      getAllLogEntries: jest.fn(),
    };
    const useCase = new CreateLogEntryUseCase(repository);

    const created = await useCase.execute({
      level: 'info',
      message: 'hello',
    });

    expect(created).toBe(true);
    expect(repository.createLogEntry).toHaveBeenCalledTimes(1);
    const [logEntry] = repository.createLogEntry.mock.calls[0];
    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe('hello');
  });
});
```

```ts
// src/application/use-cases/log-entry/delete-log-entry.use-case.spec.ts
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryNotFoundError } from '@/shared/errors/domain';
import { DeleteLogEntryUseCase } from './delete-log-entry.use-case';

describe('DeleteLogEntryUseCase', () => {
  it('throws LogEntryNotFoundError when missing', async () => {
    const repository: jest.Mocked<LogEntryRepository> = {
      createLogEntry: jest.fn(),
      deleteLogEntry: jest.fn(),
      existsById: jest.fn().mockResolvedValue(null),
      getAllLogEntries: jest.fn(),
    };
    const useCase = new DeleteLogEntryUseCase(repository);

    await expect(useCase.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      LogEntryNotFoundError,
    );
  });

  it('deletes an existing log entry', async () => {
    const existing = new LogEntry('l1', 'info', 'hello');
    const repository: jest.Mocked<LogEntryRepository> = {
      createLogEntry: jest.fn(),
      deleteLogEntry: jest.fn().mockResolvedValue(true),
      existsById: jest.fn().mockResolvedValue(existing),
      getAllLogEntries: jest.fn(),
    };
    const useCase = new DeleteLogEntryUseCase(repository);

    const result = await useCase.execute({ id: 'l1' });

    expect(result).toBe(true);
    expect(repository.deleteLogEntry).toHaveBeenCalledWith(existing);
  });
});
```

- [ ] **Step 9: Run tests to verify they fail**

Run: `npm test -- log-entry`
Expected: FAIL with "Cannot find module './create-log-entry.use-case'" (and similar)

- [ ] **Step 10: Write the use cases**

```ts
// src/application/use-cases/log-entry/create-log-entry.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { CreateLogEntryDTO } from '@/application/dtos/log-entry/create-log-entry.dto';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntry } from '@/domain/entities/log-entry';
import { generateID } from '@/infrastructure/utils/StringUtils';

@Injectable()
export class CreateLogEntryUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(request: CreateLogEntryDTO): Promise<boolean> {
    const { level, message, context, executionId } = request;

    const id = generateID();

    const logEntry = new LogEntry(id, level, message, context, executionId);

    const created = await this.logEntryRepository.createLogEntry(logEntry);

    return created;
  }
}
```

```ts
// src/application/use-cases/log-entry/delete-log-entry.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { DeleteLogEntryDTO } from '@/application/dtos/log-entry/delete-log-entry.dto';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntryNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteLogEntryUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(request: DeleteLogEntryDTO): Promise<boolean> {
    const { id } = request;

    const existing = await this.logEntryRepository.existsById(id);

    if (!existing) {
      throw new LogEntryNotFoundError(`Log entry with id ${id} was not found.`);
    }

    const deleted = await this.logEntryRepository.deleteLogEntry(existing);

    return deleted;
  }
}
```

```ts
// src/application/use-cases/log-entry/get-log-entry-by-id.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { GetLogEntryByIdDTO } from '@/application/dtos/log-entry/get-log-entry-by-id.dto';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntry } from '@/domain/entities/log-entry';

@Injectable()
export class GetLogEntryByIdUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(request: GetLogEntryByIdDTO): Promise<LogEntry | null> {
    const { id } = request;

    const logEntry = await this.logEntryRepository.existsById(id);

    return logEntry;
  }
}
```

```ts
// src/application/use-cases/log-entry/get-all-log-entries.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntry } from '@/domain/entities/log-entry';

@Injectable()
export class GetAllLogEntriesUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(): Promise<LogEntry[]> {
    const logEntries = await this.logEntryRepository.getAllLogEntries();

    return logEntries;
  }
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm test -- log-entry`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/@types/IDs.ts src/shared/errors/domain.ts src/domain/entities/log-entry.ts src/domain/entities/log-entry.spec.ts src/application/repositories/log-entry.repository.ts src/application/dtos/log-entry src/application/use-cases/log-entry
git commit -m "feat: add LogEntry domain entity, port, DTOs, and use cases"
```

---

### Task 8: Database module (Config + Mongoose root connection)

**Files:**
- Create: `src/infrastructure/database/database.module.ts`
- Test: `src/infrastructure/database/database.module.spec.ts`

**Interfaces:**
- Consumes: `MONGODB_URI` env var via `@nestjs/config`'s `ConfigService`.
- Produces: `DatabaseModule` — a global module exporting `MongooseModule`'s connection, importable once from `AppModule` (Task 26) and re-importable by every feature module that calls `MongooseModule.forFeature(...)` (Tasks 9-13).

- [ ] **Step 1: Write the failing test**

```ts
// src/infrastructure/database/database.module.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DatabaseModule } from './database.module';

describe('DatabaseModule', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
  });

  afterAll(async () => {
    await mongod.stop();
  });

  it('establishes a Mongoose connection from MONGODB_URI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();

    const connection = moduleRef.get(getConnectionToken());

    expect(connection.readyState).toBe(1);

    await moduleRef.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- database.module.spec.ts`
Expected: FAIL with "Cannot find module './database.module'"

- [ ] **Step 3: Write the implementation**

```ts
// src/infrastructure/database/database.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/gluecode',
        ),
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- database.module.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/database/database.module.ts src/infrastructure/database/database.module.spec.ts
git commit -m "feat: add MongoDB DatabaseModule"
```

---

### Task 9: Step MongoDB repository + StepModule

**Files:**
- Create: `src/infrastructure/database/step/step.schema.ts`
- Create: `src/infrastructure/database/step/step.mapper.ts`
- Create: `src/infrastructure/database/step/step.mongo.repository.ts`
- Create: `src/infrastructure/database/step/step.module.ts`
- Test: `src/infrastructure/database/step/step.mongo.repository.spec.ts`

**Interfaces:**
- Consumes: `StepRepository` port (`@/application/repositories/step.repository`), `STEP_REPOSITORY` token, `Mapper<In,Out>` base class (`@/base/mapper`).
- Produces: `StepModule` — importable by `AppModule` and by any module needing `STEP_REPOSITORY` or the Step use cases (exports both). `StepSchemaClass`/`StepSchema`/`StepDocument` reused nowhere outside this folder.

- [ ] **Step 1: Write the failing repository test**

```ts
// src/infrastructure/database/step/step.mongo.repository.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { StepKind } from '@/@types/enums';
import { STEP_REPOSITORY } from '@/application/tokens';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { StepModule } from './step.module';

describe('StepMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: StepRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        StepModule,
      ],
    }).compile();

    repository = moduleRef.get<StepRepository>(STEP_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  it('creates, reads, updates, lists and deletes a step', async () => {
    const step = new Step('s1', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'info',
    });

    expect(await repository.createStep(step)).toBe(true);

    const found = await repository.existsById('s1');
    expect(found?.id).toBe('s1');
    expect(found?.kind).toBe(StepKind.LOG);

    const updated = await repository.updateStep(
      new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'error' }),
    );
    expect(updated?.config).toEqual({ kind: StepKind.LOG, level: 'error' });

    const all = await repository.getAllSteps();
    expect(all).toHaveLength(1);

    expect(await repository.deleteStep(step)).toBe(true);
    expect(await repository.existsById('s1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- step.mongo.repository.spec.ts`
Expected: FAIL with "Cannot find module './step.module'"

- [ ] **Step 3: Write the Mongoose schema**

```ts
// src/infrastructure/database/step/step.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StepConfig } from '@/@types/domain';
import { StepKind } from '@/@types/enums';

@Schema({ collection: 'steps', timestamps: true, _id: false })
export class StepSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, enum: Object.values(StepKind), required: true })
  kind: StepKind;

  @Prop({ type: Object, required: true })
  config: StepConfig;
}

export type StepDocument = HydratedDocument<StepSchemaClass>;
export const StepSchema = SchemaFactory.createForClass(StepSchemaClass);
```

- [ ] **Step 4: Write the mapper**

```ts
// src/infrastructure/database/step/step.mapper.ts
import { Mapper } from '@/base/mapper';
import { Step } from '@/domain/entities/step';
import { StepDocument, StepSchemaClass } from './step.schema';

export class StepMapper extends Mapper<Step, StepDocument> {
  mapFrom(input: StepDocument): Step {
    return new Step(input._id, input.kind, input.config);
  }

  mapTo(input: Step): Partial<StepSchemaClass> {
    return {
      _id: input.id,
      kind: input.kind,
      config: input.config,
    };
  }
}
```

- [ ] **Step 5: Write the repository implementation**

```ts
// src/infrastructure/database/step/step.mongo.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { StepDocument, StepSchemaClass } from './step.schema';
import { StepMapper } from './step.mapper';

@Injectable()
export class StepMongoRepository implements StepRepository {
  private readonly mapper = new StepMapper();

  constructor(
    @InjectModel(StepSchemaClass.name)
    private readonly model: Model<StepDocument>,
  ) {}

  async createStep(step: Step): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(step));
    return true;
  }

  async updateStep(step: Step): Promise<Step | null> {
    const doc = await this.model
      .findByIdAndUpdate(step.id, this.mapper.mapTo(step), { new: true })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deleteStep(step: Step): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: step.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(stepId: string): Promise<Step | null> {
    const doc = await this.model.findById(stepId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllSteps(): Promise<Step[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
```

- [ ] **Step 6: Write the feature module**

```ts
// src/infrastructure/database/step/step.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { STEP_REPOSITORY } from '@/application/tokens';
import { CreateStepUseCase } from '@/application/use-cases/step/create-step.use-case';
import { UpdateStepUseCase } from '@/application/use-cases/step/update-step.use-case';
import { DeleteStepUseCase } from '@/application/use-cases/step/delete-step.use-case';
import { GetStepByIdUseCase } from '@/application/use-cases/step/get-step-by-id.use-case';
import { GetAllStepsUseCase } from '@/application/use-cases/step/get-all-steps.use-case';
import { StepSchema, StepSchemaClass } from './step.schema';
import { StepMongoRepository } from './step.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StepSchemaClass.name, schema: StepSchema },
    ]),
  ],
  providers: [
    { provide: STEP_REPOSITORY, useClass: StepMongoRepository },
    CreateStepUseCase,
    UpdateStepUseCase,
    DeleteStepUseCase,
    GetStepByIdUseCase,
    GetAllStepsUseCase,
  ],
  exports: [
    STEP_REPOSITORY,
    CreateStepUseCase,
    UpdateStepUseCase,
    DeleteStepUseCase,
    GetStepByIdUseCase,
    GetAllStepsUseCase,
  ],
})
export class StepModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- step.mongo.repository.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/database/step
git commit -m "feat: add Step MongoDB repository and StepModule"
```

---

### Task 10: Pipeline MongoDB repository (embeds steps) + PipelineModule

**Files:**
- Create: `src/infrastructure/database/pipeline/pipeline.schema.ts`
- Create: `src/infrastructure/database/pipeline/pipeline.mapper.ts`
- Create: `src/infrastructure/database/pipeline/pipeline.mongo.repository.ts`
- Create: `src/infrastructure/database/pipeline/pipeline.module.ts`
- Test: `src/infrastructure/database/pipeline/pipeline.mongo.repository.spec.ts`

**Interfaces:**
- Consumes: `PipelineRepository` port, `PIPELINE_REPOSITORY` token, `Pipeline.getSteps()` (Task 4).
- Produces: `PipelineModule`, exporting `PIPELINE_REPOSITORY` and the five Pipeline use cases — consumed by Task 18 (`PipelineExecutionProcessor`) and Task 21 (`IntegrationsController`).

- [ ] **Step 1: Write the failing repository test**

```ts
// src/infrastructure/database/pipeline/pipeline.mongo.repository.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { StepKind, PipelineStatus } from '@/@types/enums';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';
import { PipelineModule } from './pipeline.module';

describe('PipelineMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: PipelineRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        PipelineModule,
      ],
    }).compile();

    repository = moduleRef.get<PipelineRepository>(PIPELINE_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  const buildPipeline = () =>
    new Pipeline(
      'p1',
      [new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' })],
      PipelineStatus.IDLE,
      'My Pipeline',
      'A description',
    );

  it('creates, reads, updates, lists and deletes a pipeline with embedded steps', async () => {
    const pipeline = buildPipeline();

    expect(await repository.createPipeline(pipeline)).toBe(true);

    const found = await repository.existsById('p1');
    expect(found?.name).toBe('My Pipeline');
    expect(found?.getSteps()).toHaveLength(1);
    expect(found?.getSteps()[0].kind).toBe(StepKind.LOG);

    const updated = await repository.updatePipeline(
      new Pipeline(
        'p1',
        [new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'error' })],
        PipelineStatus.COMPLETED,
        'Renamed',
      ),
    );
    expect(updated?.name).toBe('Renamed');
    expect(updated?.status).toBe(PipelineStatus.COMPLETED);

    const all = await repository.getAllPipelines();
    expect(all).toHaveLength(1);

    expect(await repository.deletePipeline(pipeline)).toBe(true);
    expect(await repository.existsById('p1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pipeline.mongo.repository.spec.ts`
Expected: FAIL with "Cannot find module './pipeline.module'"

- [ ] **Step 3: Write the Mongoose schema (steps embedded as a sub-document array)**

```ts
// src/infrastructure/database/pipeline/pipeline.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StepConfig } from '@/@types/domain';
import { PipelineStatus, StepKind } from '@/@types/enums';

@Schema({ _id: false })
export class EmbeddedStepSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, enum: Object.values(StepKind), required: true })
  kind: StepKind;

  @Prop({ type: Object, required: true })
  config: StepConfig;
}

export const EmbeddedStepSchema = SchemaFactory.createForClass(
  EmbeddedStepSchemaClass,
);

@Schema({ collection: 'pipelines', timestamps: true, _id: false })
export class PipelineSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: [EmbeddedStepSchema], required: true })
  steps: EmbeddedStepSchemaClass[];

  @Prop({
    type: String,
    enum: Object.values(PipelineStatus),
    required: true,
    default: PipelineStatus.IDLE,
  })
  status: PipelineStatus;

  @Prop({ type: String })
  name?: string;

  @Prop({ type: String })
  description?: string;
}

export type PipelineDocument = HydratedDocument<PipelineSchemaClass>;
export const PipelineSchema = SchemaFactory.createForClass(PipelineSchemaClass);
```

- [ ] **Step 4: Write the mapper**

```ts
// src/infrastructure/database/pipeline/pipeline.mapper.ts
import { Mapper } from '@/base/mapper';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';
import { PipelineDocument, PipelineSchemaClass } from './pipeline.schema';

export class PipelineMapper extends Mapper<Pipeline, PipelineDocument> {
  mapFrom(input: PipelineDocument): Pipeline {
    const steps = input.steps.map(
      (step) => new Step(step._id, step.kind, step.config),
    );
    return new Pipeline(
      input._id,
      steps,
      input.status,
      input.name,
      input.description,
    );
  }

  mapTo(input: Pipeline): Partial<PipelineSchemaClass> {
    return {
      _id: input.id,
      steps: input.getSteps().map((step) => ({
        _id: step.id,
        kind: step.kind,
        config: step.config,
      })),
      status: input.status,
      name: input.name,
      description: input.description,
    };
  }
}
```

- [ ] **Step 5: Write the repository implementation**

```ts
// src/infrastructure/database/pipeline/pipeline.mongo.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';
import { PipelineDocument, PipelineSchemaClass } from './pipeline.schema';
import { PipelineMapper } from './pipeline.mapper';

@Injectable()
export class PipelineMongoRepository implements PipelineRepository {
  private readonly mapper = new PipelineMapper();

  constructor(
    @InjectModel(PipelineSchemaClass.name)
    private readonly model: Model<PipelineDocument>,
  ) {}

  async createPipeline(pipeline: Pipeline): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(pipeline));
    return true;
  }

  async updatePipeline(pipeline: Pipeline): Promise<Pipeline | null> {
    const doc = await this.model
      .findByIdAndUpdate(pipeline.id, this.mapper.mapTo(pipeline), {
        new: true,
      })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deletePipeline(pipeline: Pipeline): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: pipeline.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(pipelineId: string): Promise<Pipeline | null> {
    const doc = await this.model.findById(pipelineId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllPipelines(): Promise<Pipeline[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
```

- [ ] **Step 6: Write the feature module**

```ts
// src/infrastructure/database/pipeline/pipeline.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { CreatePipelineUseCase } from '@/application/use-cases/pipeline/create-pipeline.use-case';
import { UpdatePipelineUseCase } from '@/application/use-cases/pipeline/update-pipeline.use-case';
import { DeletePipelineUseCase } from '@/application/use-cases/pipeline/delete-pipeline.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { GetAllPipelinesUseCase } from '@/application/use-cases/pipeline/get-all-pipelines.use-case';
import { PipelineSchema, PipelineSchemaClass } from './pipeline.schema';
import { PipelineMongoRepository } from './pipeline.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PipelineSchemaClass.name, schema: PipelineSchema },
    ]),
  ],
  providers: [
    { provide: PIPELINE_REPOSITORY, useClass: PipelineMongoRepository },
    CreatePipelineUseCase,
    UpdatePipelineUseCase,
    DeletePipelineUseCase,
    GetPipelineByIdUseCase,
    GetAllPipelinesUseCase,
  ],
  exports: [
    PIPELINE_REPOSITORY,
    CreatePipelineUseCase,
    UpdatePipelineUseCase,
    DeletePipelineUseCase,
    GetPipelineByIdUseCase,
    GetAllPipelinesUseCase,
  ],
})
export class PipelineModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- pipeline.mongo.repository.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/database/pipeline
git commit -m "feat: add Pipeline MongoDB repository (embedded steps) and PipelineModule"
```

---

### Task 11: Connector MongoDB repository + ConnectorModule

**Files:**
- Create: `src/infrastructure/database/connector/connector.schema.ts`
- Create: `src/infrastructure/database/connector/connector.mapper.ts`
- Create: `src/infrastructure/database/connector/connector.mongo.repository.ts`
- Create: `src/infrastructure/database/connector/connector.module.ts`
- Test: `src/infrastructure/database/connector/connector.mongo.repository.spec.ts`

**Interfaces:**
- Consumes: `ConnectorRepository` port, `CONNECTOR_REPOSITORY` token.
- Produces: `ConnectorModule`, exporting `CONNECTOR_REPOSITORY` and the five Connector use cases.

- [ ] **Step 1: Write the failing repository test**

```ts
// src/infrastructure/database/connector/connector.mongo.repository.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { ConnectorModule } from './connector.module';

describe('ConnectorMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: ConnectorRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        ConnectorModule,
      ],
    }).compile();

    repository = moduleRef.get<ConnectorRepository>(CONNECTOR_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  const buildConnector = () =>
    new Connector(
      'c1',
      { url: 'https://source.test', method: 'GET' },
      { type: 'object' },
      [{ sourcePath: '$.a', targetPath: '$.b', transform: 'identity' }],
      { url: 'https://dest.test', method: 'POST' },
      { type: 'none' },
    );

  it('creates, reads, updates, lists and deletes a connector', async () => {
    const connector = buildConnector();

    expect(await repository.createConnector(connector)).toBe(true);

    const found = await repository.existsById('c1');
    expect(found?.destination.url).toBe('https://dest.test');

    const updated = await repository.updateConnector(
      new Connector(
        'c1',
        connector.source,
        connector.schema,
        connector.mapping,
        { url: 'https://new-dest.test', method: 'PUT' },
        connector.auth,
      ),
    );
    expect(updated?.destination.url).toBe('https://new-dest.test');

    const all = await repository.getAllConnectors();
    expect(all).toHaveLength(1);

    expect(await repository.deleteConnector(connector)).toBe(true);
    expect(await repository.existsById('c1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- connector.mongo.repository.spec.ts`
Expected: FAIL with "Cannot find module './connector.module'"

- [ ] **Step 3: Write the Mongoose schema**

```ts
// src/infrastructure/database/connector/connector.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  AuthSpec,
  EndpointSpec,
  FieldMapping,
  JsonSchema,
} from '@/@types/domain';

@Schema({ collection: 'connectors', timestamps: true, _id: false })
export class ConnectorSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Object, required: true })
  source: EndpointSpec;

  @Prop({ type: Object, required: true })
  schema: JsonSchema;

  @Prop({ type: [Object], required: true })
  mapping: FieldMapping[];

  @Prop({ type: Object, required: true })
  destination: EndpointSpec;

  @Prop({ type: Object, required: true })
  auth: AuthSpec;
}

export type ConnectorDocument = HydratedDocument<ConnectorSchemaClass>;
export const ConnectorSchema = SchemaFactory.createForClass(
  ConnectorSchemaClass,
);
```

- [ ] **Step 4: Write the mapper**

```ts
// src/infrastructure/database/connector/connector.mapper.ts
import { Mapper } from '@/base/mapper';
import { Connector } from '@/domain/entities/connector';
import { ConnectorDocument, ConnectorSchemaClass } from './connector.schema';

export class ConnectorMapper extends Mapper<Connector, ConnectorDocument> {
  mapFrom(input: ConnectorDocument): Connector {
    return new Connector(
      input._id,
      input.source,
      input.schema,
      input.mapping,
      input.destination,
      input.auth,
    );
  }

  mapTo(input: Connector): Partial<ConnectorSchemaClass> {
    return {
      _id: input.id,
      source: input.source,
      schema: input.schema,
      mapping: input.mapping,
      destination: input.destination,
      auth: input.auth,
    };
  }
}
```

- [ ] **Step 5: Write the repository implementation**

```ts
// src/infrastructure/database/connector/connector.mongo.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { ConnectorDocument, ConnectorSchemaClass } from './connector.schema';
import { ConnectorMapper } from './connector.mapper';

@Injectable()
export class ConnectorMongoRepository implements ConnectorRepository {
  private readonly mapper = new ConnectorMapper();

  constructor(
    @InjectModel(ConnectorSchemaClass.name)
    private readonly model: Model<ConnectorDocument>,
  ) {}

  async createConnector(connector: Connector): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(connector));
    return true;
  }

  async updateConnector(connector: Connector): Promise<Connector | null> {
    const doc = await this.model
      .findByIdAndUpdate(connector.id, this.mapper.mapTo(connector), {
        new: true,
      })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deleteConnector(connector: Connector): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: connector.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(connectorId: string): Promise<Connector | null> {
    const doc = await this.model.findById(connectorId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllConnectors(): Promise<Connector[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
```

- [ ] **Step 6: Write the feature module**

```ts
// src/infrastructure/database/connector/connector.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { CreateConnectorUseCase } from '@/application/use-cases/connector/create-connector.use-case';
import { UpdateConnectorUseCase } from '@/application/use-cases/connector/update-connector.use-case';
import { DeleteConnectorUseCase } from '@/application/use-cases/connector/delete-connector.use-case';
import { GetConnectorByIdUseCase } from '@/application/use-cases/connector/get-connector-by-id.use-case';
import { GetAllConnectorsUseCase } from '@/application/use-cases/connector/get-all-connectors.use-case';
import { ConnectorSchema, ConnectorSchemaClass } from './connector.schema';
import { ConnectorMongoRepository } from './connector.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConnectorSchemaClass.name, schema: ConnectorSchema },
    ]),
  ],
  providers: [
    { provide: CONNECTOR_REPOSITORY, useClass: ConnectorMongoRepository },
    CreateConnectorUseCase,
    UpdateConnectorUseCase,
    DeleteConnectorUseCase,
    GetConnectorByIdUseCase,
    GetAllConnectorsUseCase,
  ],
  exports: [
    CONNECTOR_REPOSITORY,
    CreateConnectorUseCase,
    UpdateConnectorUseCase,
    DeleteConnectorUseCase,
    GetConnectorByIdUseCase,
    GetAllConnectorsUseCase,
  ],
})
export class ConnectorModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- connector.mongo.repository.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/database/connector
git commit -m "feat: add Connector MongoDB repository and ConnectorModule"
```

---

### Task 12: Execution MongoDB repository + ExecutionModule

**Files:**
- Create: `src/infrastructure/database/execution/execution.schema.ts`
- Create: `src/infrastructure/database/execution/execution.mapper.ts`
- Create: `src/infrastructure/database/execution/execution.mongo.repository.ts`
- Create: `src/infrastructure/database/execution/execution.module.ts`
- Test: `src/infrastructure/database/execution/execution.mongo.repository.spec.ts`

**Interfaces:**
- Consumes: `ExecutionRepository` port, `EXECUTION_REPOSITORY` token.
- Produces: `ExecutionModule`, exporting `EXECUTION_REPOSITORY` and the five Execution use cases — consumed by Task 18 (`PipelineExecutionProcessor`) and Task 24 (`ExecutionsController`).

- [ ] **Step 1: Write the failing repository test**

```ts
// src/infrastructure/database/execution/execution.mongo.repository.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';
import { ExecutionModule } from './execution.module';

describe('ExecutionMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: ExecutionRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        ExecutionModule,
      ],
    }).compile();

    repository = moduleRef.get<ExecutionRepository>(EXECUTION_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  it('creates, reads, updates, lists and deletes an execution', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const execution = new Execution('e1', 'p1', 'PENDING', startedAt);

    expect(await repository.createExecution(execution)).toBe(true);

    const found = await repository.existsById('e1');
    expect(found?.status).toBe('PENDING');

    const completedAt = new Date('2026-01-01T00:05:00.000Z');
    const updated = await repository.updateExecution(
      new Execution('e1', 'p1', 'COMPLETED', startedAt, completedAt),
    );
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.completedAt?.toISOString()).toBe(
      completedAt.toISOString(),
    );

    const all = await repository.getAllExecutions();
    expect(all).toHaveLength(1);

    expect(await repository.deleteExecution(execution)).toBe(true);
    expect(await repository.existsById('e1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- execution.mongo.repository.spec.ts`
Expected: FAIL with "Cannot find module './execution.module'"

- [ ] **Step 3: Write the Mongoose schema**

```ts
// src/infrastructure/database/execution/execution.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

@Schema({ collection: 'executions', timestamps: true, _id: false })
export class ExecutionSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  pipelineId: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
    required: true,
  })
  status: ExecutionStatus;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export type ExecutionDocument = HydratedDocument<ExecutionSchemaClass>;
export const ExecutionSchema = SchemaFactory.createForClass(
  ExecutionSchemaClass,
);
```

- [ ] **Step 4: Write the mapper**

```ts
// src/infrastructure/database/execution/execution.mapper.ts
import { Mapper } from '@/base/mapper';
import { Execution } from '@/domain/entities/execution';
import { ExecutionDocument, ExecutionSchemaClass } from './execution.schema';

export class ExecutionMapper extends Mapper<Execution, ExecutionDocument> {
  mapFrom(input: ExecutionDocument): Execution {
    return new Execution(
      input._id,
      input.pipelineId,
      input.status,
      input.startedAt,
      input.completedAt,
    );
  }

  mapTo(input: Execution): Partial<ExecutionSchemaClass> {
    return {
      _id: input.id,
      pipelineId: input.pipelineId,
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    };
  }
}
```

- [ ] **Step 5: Write the repository implementation**

```ts
// src/infrastructure/database/execution/execution.mongo.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';
import { ExecutionDocument, ExecutionSchemaClass } from './execution.schema';
import { ExecutionMapper } from './execution.mapper';

@Injectable()
export class ExecutionMongoRepository implements ExecutionRepository {
  private readonly mapper = new ExecutionMapper();

  constructor(
    @InjectModel(ExecutionSchemaClass.name)
    private readonly model: Model<ExecutionDocument>,
  ) {}

  async createExecution(execution: Execution): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(execution));
    return true;
  }

  async updateExecution(execution: Execution): Promise<Execution | null> {
    const doc = await this.model
      .findByIdAndUpdate(execution.id, this.mapper.mapTo(execution), {
        new: true,
      })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deleteExecution(execution: Execution): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: execution.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(executionId: string): Promise<Execution | null> {
    const doc = await this.model.findById(executionId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllExecutions(): Promise<Execution[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
```

- [ ] **Step 6: Write the feature module**

```ts
// src/infrastructure/database/execution/execution.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { CreateExecutionUseCase } from '@/application/use-cases/execution/create-execution.use-case';
import { UpdateExecutionUseCase } from '@/application/use-cases/execution/update-execution.use-case';
import { DeleteExecutionUseCase } from '@/application/use-cases/execution/delete-execution.use-case';
import { GetExecutionByIdUseCase } from '@/application/use-cases/execution/get-execution-by-id.use-case';
import { GetAllExecutionsUseCase } from '@/application/use-cases/execution/get-all-executions.use-case';
import { ExecutionSchema, ExecutionSchemaClass } from './execution.schema';
import { ExecutionMongoRepository } from './execution.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutionSchemaClass.name, schema: ExecutionSchema },
    ]),
  ],
  providers: [
    { provide: EXECUTION_REPOSITORY, useClass: ExecutionMongoRepository },
    CreateExecutionUseCase,
    UpdateExecutionUseCase,
    DeleteExecutionUseCase,
    GetExecutionByIdUseCase,
    GetAllExecutionsUseCase,
  ],
  exports: [
    EXECUTION_REPOSITORY,
    CreateExecutionUseCase,
    UpdateExecutionUseCase,
    DeleteExecutionUseCase,
    GetExecutionByIdUseCase,
    GetAllExecutionsUseCase,
  ],
})
export class ExecutionModule {}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- execution.mongo.repository.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/database/execution
git commit -m "feat: add Execution MongoDB repository and ExecutionModule"
```

---

### Task 13: LogEntry MongoDB repository, LoggerPort, MongoLoggerService + LogEntryModule

**Files:**
- Create: `src/infrastructure/database/log-entry/log-entry.schema.ts`
- Create: `src/infrastructure/database/log-entry/log-entry.mapper.ts`
- Create: `src/infrastructure/database/log-entry/log-entry.mongo.repository.ts`
- Create: `src/application/ports/logger.port.ts`
- Create: `src/infrastructure/logging/mongo-logger.service.ts`
- Create: `src/infrastructure/database/log-entry/log-entry.module.ts`
- Test: `src/infrastructure/database/log-entry/log-entry.mongo.repository.spec.ts`
- Test: `src/infrastructure/logging/mongo-logger.service.spec.ts`

**Interfaces:**
- Consumes: `LogEntryRepository` port, `LOG_ENTRY_REPOSITORY`/`LOGGER_PORT` tokens (Task 2), `CreateLogEntryUseCase` (Task 7).
- Produces: `LoggerPort.log(level, message, context?, executionId?): Promise<void>` — consumed by Task 17 (`LogStepExecutor`) and Task 18 (`PipelineExecutionProcessor`). `LogEntryModule` exports `LOG_ENTRY_REPOSITORY`, `LOGGER_PORT`, and the four LogEntry use cases.

- [ ] **Step 1: Write the failing repository test**

```ts
// src/infrastructure/database/log-entry/log-entry.mongo.repository.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryModule } from './log-entry.module';

describe('LogEntryMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: LogEntryRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        LogEntryModule,
      ],
    }).compile();

    repository = moduleRef.get<LogEntryRepository>(LOG_ENTRY_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  it('creates, reads, lists and deletes a log entry', async () => {
    const entry = new LogEntry('l1', 'info', 'hello', { a: 1 }, 'e1');

    expect(await repository.createLogEntry(entry)).toBe(true);

    const found = await repository.existsById('l1');
    expect(found?.message).toBe('hello');
    expect(found?.executionId).toBe('e1');

    const all = await repository.getAllLogEntries();
    expect(all).toHaveLength(1);

    expect(await repository.deleteLogEntry(entry)).toBe(true);
    expect(await repository.existsById('l1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- log-entry.mongo.repository.spec.ts`
Expected: FAIL with "Cannot find module './log-entry.module'"

- [ ] **Step 3: Write the Mongoose schema**

```ts
// src/infrastructure/database/log-entry/log-entry.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LogLevel } from '@/domain/entities/log-entry';

@Schema({ collection: 'logs', timestamps: true, _id: false })
export class LogEntrySchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, enum: ['info', 'warn', 'error'], required: true })
  level: LogLevel;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Object })
  context?: Record<string, unknown>;

  @Prop({ type: String })
  executionId?: string;
}

export type LogEntryDocument = HydratedDocument<LogEntrySchemaClass>;
export const LogEntrySchema = SchemaFactory.createForClass(
  LogEntrySchemaClass,
);
```

- [ ] **Step 4: Write the mapper**

```ts
// src/infrastructure/database/log-entry/log-entry.mapper.ts
import { Mapper } from '@/base/mapper';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryDocument, LogEntrySchemaClass } from './log-entry.schema';

export class LogEntryMapper extends Mapper<LogEntry, LogEntryDocument> {
  mapFrom(input: LogEntryDocument): LogEntry {
    return new LogEntry(
      input._id,
      input.level,
      input.message,
      input.context,
      input.executionId,
    );
  }

  mapTo(input: LogEntry): Partial<LogEntrySchemaClass> {
    return {
      _id: input.id,
      level: input.level,
      message: input.message,
      context: input.context,
      executionId: input.executionId,
    };
  }
}
```

- [ ] **Step 5: Write the repository implementation**

```ts
// src/infrastructure/database/log-entry/log-entry.mongo.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryDocument, LogEntrySchemaClass } from './log-entry.schema';
import { LogEntryMapper } from './log-entry.mapper';

@Injectable()
export class LogEntryMongoRepository implements LogEntryRepository {
  private readonly mapper = new LogEntryMapper();

  constructor(
    @InjectModel(LogEntrySchemaClass.name)
    private readonly model: Model<LogEntryDocument>,
  ) {}

  async createLogEntry(logEntry: LogEntry): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(logEntry));
    return true;
  }

  async deleteLogEntry(logEntry: LogEntry): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: logEntry.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(logEntryId: string): Promise<LogEntry | null> {
    const doc = await this.model.findById(logEntryId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllLogEntries(): Promise<LogEntry[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
```

- [ ] **Step 6: Write the LoggerPort interface**

```ts
// src/application/ports/logger.port.ts
import { ExecutionId } from '@/@types/IDs';
import { LogLevel } from '@/domain/entities/log-entry';

export interface LoggerPort {
  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    executionId?: ExecutionId,
  ): Promise<void>;
}
```

- [ ] **Step 7: Write the failing MongoLoggerService test**

```ts
// src/infrastructure/logging/mongo-logger.service.spec.ts
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { MongoLoggerService } from './mongo-logger.service';

describe('MongoLoggerService', () => {
  it('delegates to CreateLogEntryUseCase with the given fields', async () => {
    const createLogEntryUseCase = {
      execute: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<CreateLogEntryUseCase>;
    const service = new MongoLoggerService(createLogEntryUseCase);

    await service.log('warn', 'careful', { stepId: 's1' }, 'e1');

    expect(createLogEntryUseCase.execute).toHaveBeenCalledWith({
      level: 'warn',
      message: 'careful',
      context: { stepId: 's1' },
      executionId: 'e1',
    });
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm test -- mongo-logger.service.spec.ts`
Expected: FAIL with "Cannot find module './mongo-logger.service'"

- [ ] **Step 9: Write MongoLoggerService**

```ts
// src/infrastructure/logging/mongo-logger.service.ts
import { Injectable } from '@nestjs/common';
import { ExecutionId } from '@/@types/IDs';
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { LoggerPort } from '@/application/ports/logger.port';
import { LogLevel } from '@/domain/entities/log-entry';

@Injectable()
export class MongoLoggerService implements LoggerPort {
  constructor(private readonly createLogEntryUseCase: CreateLogEntryUseCase) {}

  async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    executionId?: ExecutionId,
  ): Promise<void> {
    await this.createLogEntryUseCase.execute({
      level,
      message,
      context,
      executionId,
    });
  }
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test -- mongo-logger.service.spec.ts`
Expected: PASS

- [ ] **Step 11: Write the feature module (binds both tokens)**

```ts
// src/infrastructure/database/log-entry/log-entry.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LOG_ENTRY_REPOSITORY, LOGGER_PORT } from '@/application/tokens';
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { DeleteLogEntryUseCase } from '@/application/use-cases/log-entry/delete-log-entry.use-case';
import { GetLogEntryByIdUseCase } from '@/application/use-cases/log-entry/get-log-entry-by-id.use-case';
import { GetAllLogEntriesUseCase } from '@/application/use-cases/log-entry/get-all-log-entries.use-case';
import { LogEntrySchema, LogEntrySchemaClass } from './log-entry.schema';
import { LogEntryMongoRepository } from './log-entry.mongo.repository';
import { MongoLoggerService } from '../../logging/mongo-logger.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LogEntrySchemaClass.name, schema: LogEntrySchema },
    ]),
  ],
  providers: [
    { provide: LOG_ENTRY_REPOSITORY, useClass: LogEntryMongoRepository },
    { provide: LOGGER_PORT, useClass: MongoLoggerService },
    CreateLogEntryUseCase,
    DeleteLogEntryUseCase,
    GetLogEntryByIdUseCase,
    GetAllLogEntriesUseCase,
  ],
  exports: [
    LOG_ENTRY_REPOSITORY,
    LOGGER_PORT,
    CreateLogEntryUseCase,
    DeleteLogEntryUseCase,
    GetLogEntryByIdUseCase,
    GetAllLogEntriesUseCase,
  ],
})
export class LogEntryModule {}
```

- [ ] **Step 12: Run the repository test to verify it passes**

Run: `npm test -- log-entry.mongo.repository.spec.ts`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/infrastructure/database/log-entry src/infrastructure/logging src/application/ports
git commit -m "feat: add LogEntry MongoDB repository, LoggerPort, and MongoLoggerService"
```

---

### Task 14: StepExecutor interface + Receive/Validate/Transform executors

**Files:**
- Create: `src/infrastructure/execution/step-executor.ts`
- Create: `src/infrastructure/execution/receive-step.executor.ts`
- Create: `src/infrastructure/execution/validate-step.executor.ts`
- Create: `src/infrastructure/execution/transform-step.executor.ts`
- Create: `src/infrastructure/execution/json-path.util.ts`
- Test: `src/infrastructure/execution/receive-step.executor.spec.ts`
- Test: `src/infrastructure/execution/validate-step.executor.spec.ts`
- Test: `src/infrastructure/execution/transform-step.executor.spec.ts`

**Interfaces:**
- Consumes: `Step`, `StepResult` (`@/domain/entities/step`), `StepKind` (`@/@types/enums`).
- Produces: `StepExecutor` interface (`execute(step, payload): Promise<StepResult>`) — implemented here by three of the five strategies Task 16/17's `StepExecutorRegistry` assembles; `getByPath`/`setByPath` helpers reused only within this folder.

- [ ] **Step 1: Write the failing tests**

```ts
// src/infrastructure/execution/receive-step.executor.spec.ts
import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { ReceiveStepExecutor } from './receive-step.executor';

describe('ReceiveStepExecutor', () => {
  it('passes the payload through unchanged', async () => {
    const step = new Step('s1', StepKind.RECEIVE, {
      kind: StepKind.RECEIVE,
      source: { url: 'https://source.test', method: 'GET' },
    });
    const executor = new ReceiveStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({ hello: 'world' });
  });
});
```

```ts
// src/infrastructure/execution/validate-step.executor.spec.ts
import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { ValidateStepExecutor } from './validate-step.executor';

describe('ValidateStepExecutor', () => {
  const step = new Step('s1', StepKind.VALIDATE, {
    kind: StepKind.VALIDATE,
    schema: { email: 'string', age: 'number' },
  });
  const executor = new ValidateStepExecutor();

  it('succeeds when every schema key is present on the payload', async () => {
    const result = await executor.execute(step, {
      email: 'a@b.com',
      age: 30,
    });

    expect(result.status).toBe('SUCCESS');
  });

  it('fails when a schema key is missing from the payload', async () => {
    const result = await executor.execute(step, { email: 'a@b.com' });

    expect(result.status).toBe('FAILED');
  });
});
```

```ts
// src/infrastructure/execution/transform-step.executor.spec.ts
import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { TransformStepExecutor } from './transform-step.executor';

describe('TransformStepExecutor', () => {
  it('applies field mappings, including toUpperCase', async () => {
    const step = new Step('s1', StepKind.TRANSFORM, {
      kind: StepKind.TRANSFORM,
      mapping: [
        {
          sourcePath: '$.customer.email',
          targetPath: '$.contact.email_address',
          transform: 'toUpperCase',
        },
      ],
    });
    const executor = new TransformStepExecutor();

    const result = await executor.execute(step, {
      customer: { email: 'a@b.com' },
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({
      contact: { email_address: 'A@B.COM' },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- execution/receive-step.executor.spec.ts execution/validate-step.executor.spec.ts execution/transform-step.executor.spec.ts`
Expected: FAIL with "Cannot find module './receive-step.executor'" (and similar)

- [ ] **Step 3: Write the `StepExecutor` interface**

```ts
// src/infrastructure/execution/step-executor.ts
import { Step, StepResult } from '@/domain/entities/step';

export interface StepExecutor {
  execute(step: Step, payload: unknown): Promise<StepResult>;
}
```

- [ ] **Step 4: Write the dot-path helpers**

```ts
// src/infrastructure/execution/json-path.util.ts
function segmentsOf(path: string): string[] {
  return path.replace(/^\$\.?/, '').split('.').filter(Boolean);
}

export function getByPath(
  source: Record<string, unknown>,
  path: string,
): unknown {
  return segmentsOf(path).reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function setByPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = segmentsOf(path);
  let cursor = target;
  segments.forEach((key, index) => {
    if (index === segments.length - 1) {
      cursor[key] = value;
      return;
    }
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  });
}
```

- [ ] **Step 5: Write ReceiveStepExecutor**

```ts
// src/infrastructure/execution/receive-step.executor.ts
import { Injectable } from '@nestjs/common';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';

@Injectable()
export class ReceiveStepExecutor implements StepExecutor {
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    return new StepResult(step.id, 'SUCCESS', payload, new Date());
  }
}
```

- [ ] **Step 6: Write ValidateStepExecutor**

```ts
// src/infrastructure/execution/validate-step.executor.ts
import { Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';

@Injectable()
export class ValidateStepExecutor implements StepExecutor {
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.VALIDATE) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    const record = (payload ?? {}) as Record<string, unknown>;
    const missingKeys = Object.keys(step.config.schema).filter(
      (key) => !(key in record),
    );

    if (missingKeys.length > 0) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    return new StepResult(step.id, 'SUCCESS', payload, new Date());
  }
}
```

- [ ] **Step 7: Write TransformStepExecutor**

```ts
// src/infrastructure/execution/transform-step.executor.ts
import { Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { FieldMapping } from '@/@types/domain';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';
import { getByPath, setByPath } from './json-path.util';

function applyTransform(
  value: unknown,
  transform?: FieldMapping['transform'],
): unknown {
  if (transform === 'toUpperCase' && typeof value === 'string') {
    return value.toUpperCase();
  }
  if (
    transform === 'toISODate' &&
    (typeof value === 'string' || value instanceof Date)
  ) {
    return new Date(value).toISOString();
  }
  return value;
}

@Injectable()
export class TransformStepExecutor implements StepExecutor {
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.TRANSFORM) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    const source = (payload ?? {}) as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    for (const mapping of step.config.mapping) {
      const value = getByPath(source, mapping.sourcePath);
      setByPath(target, mapping.targetPath, applyTransform(value, mapping.transform));
    }

    return new StepResult(step.id, 'SUCCESS', target, new Date());
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- execution/receive-step.executor.spec.ts execution/validate-step.executor.spec.ts execution/transform-step.executor.spec.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure/execution
git commit -m "feat: add StepExecutor interface and Receive/Validate/Transform executors"
```

---

### Task 15: DispatchStepExecutor

**Files:**
- Create: `src/infrastructure/execution/dispatch-step.executor.ts`
- Test: `src/infrastructure/execution/dispatch-step.executor.spec.ts`

**Interfaces:**
- Consumes: `StepExecutor` (Task 14), global `fetch` (Node 18+ built-in, mocked in tests via `jest.spyOn(global, 'fetch')`).
- Produces: `DispatchStepExecutor implements StepExecutor`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/infrastructure/execution/dispatch-step.executor.spec.ts
import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { DispatchStepExecutor } from './dispatch-step.executor';

describe('DispatchStepExecutor', () => {
  const step = new Step('s1', StepKind.DISPATCH, {
    kind: StepKind.DISPATCH,
    destination: { url: 'https://dest.test/webhook', method: 'POST' },
    auth: { type: 'none' },
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns SUCCESS with the response body on a 2xx response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ received: true }),
    } as Response);
    const executor = new DispatchStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({ received: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://dest.test/webhook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
  });

  it('returns FAILED on a non-2xx response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);
    const executor = new DispatchStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('FAILED');
  });

  it('returns FAILED when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const executor = new DispatchStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('FAILED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dispatch-step.executor.spec.ts`
Expected: FAIL with "Cannot find module './dispatch-step.executor'"

- [ ] **Step 3: Write the implementation**

```ts
// src/infrastructure/execution/dispatch-step.executor.ts
import { Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';

@Injectable()
export class DispatchStepExecutor implements StepExecutor {
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.DISPATCH) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    const { destination } = step.config;

    try {
      const response = await fetch(destination.url, {
        method: destination.method,
        headers: { 'Content-Type': 'application/json', ...destination.headers },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return new StepResult(step.id, 'FAILED', payload, new Date());
      }

      const responseBody = await response.json().catch(() => payload);
      return new StepResult(step.id, 'SUCCESS', responseBody, new Date());
    } catch {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dispatch-step.executor.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/execution/dispatch-step.executor.ts src/infrastructure/execution/dispatch-step.executor.spec.ts
git commit -m "feat: add DispatchStepExecutor"
```

---

### Task 16: LogStepExecutor + StepExecutorRegistry provider

**Files:**
- Create: `src/infrastructure/execution/log-step.executor.ts`
- Create: `src/infrastructure/execution/step-executor.registry.ts`
- Create: `src/infrastructure/execution/step-executor.module.ts`
- Test: `src/infrastructure/execution/log-step.executor.spec.ts`
- Test: `src/infrastructure/execution/step-executor.registry.spec.ts`

**Interfaces:**
- Consumes: `LOGGER_PORT` token (Task 2), `LoggerPort` (Task 13), `STEP_EXECUTOR_REGISTRY` token (Task 2), the four executors (Tasks 14-15).
- Produces: `LogStepExecutor implements StepExecutor`; `StepExecutorRegistry = Record<StepKind, StepExecutor>` provided under `STEP_EXECUTOR_REGISTRY`; `StepExecutorModule` — imported by Task 18's `PipelineExecutionModule` and depends on `LogEntryModule` (Task 13) being imported alongside it for `LOGGER_PORT` to resolve.

- [ ] **Step 1: Write the failing LogStepExecutor test**

```ts
// src/infrastructure/execution/log-step.executor.spec.ts
import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { LoggerPort } from '@/application/ports/logger.port';
import { LogStepExecutor } from './log-step.executor';

describe('LogStepExecutor', () => {
  it('logs via LoggerPort and passes the payload through', async () => {
    const logger: jest.Mocked<LoggerPort> = { log: jest.fn().mockResolvedValue(undefined) };
    const step = new Step('s1', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'error',
    });
    const executor = new LogStepExecutor(logger);

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({ hello: 'world' });
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('s1'),
      { payload: { hello: 'world' } },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- log-step.executor.spec.ts`
Expected: FAIL with "Cannot find module './log-step.executor'"

- [ ] **Step 3: Write LogStepExecutor**

```ts
// src/infrastructure/execution/log-step.executor.ts
import { Inject, Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { Step, StepResult } from '@/domain/entities/step';
import { LoggerPort } from '@/application/ports/logger.port';
import { LOGGER_PORT } from '@/application/tokens';
import { StepExecutor } from './step-executor';

@Injectable()
export class LogStepExecutor implements StepExecutor {
  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.LOG) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    await this.logger.log(
      step.config.level === 'error' ? 'error' : 'info',
      `Step ${step.id} executed`,
      { payload },
    );

    return new StepResult(step.id, 'SUCCESS', payload, new Date());
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- log-step.executor.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the failing registry test**

```ts
// src/infrastructure/execution/step-executor.registry.spec.ts
import { StepKind } from '@/@types/enums';
import { ReceiveStepExecutor } from './receive-step.executor';
import { ValidateStepExecutor } from './validate-step.executor';
import { TransformStepExecutor } from './transform-step.executor';
import { DispatchStepExecutor } from './dispatch-step.executor';
import { LogStepExecutor } from './log-step.executor';
import { buildStepExecutorRegistry } from './step-executor.registry';

describe('buildStepExecutorRegistry', () => {
  it('maps every StepKind to its executor', () => {
    const receive = new ReceiveStepExecutor();
    const validate = new ValidateStepExecutor();
    const transform = new TransformStepExecutor();
    const dispatch = new DispatchStepExecutor();
    const log = new LogStepExecutor({ log: jest.fn() });

    const registry = buildStepExecutorRegistry(
      receive,
      validate,
      transform,
      dispatch,
      log,
    );

    expect(registry[StepKind.RECEIVE]).toBe(receive);
    expect(registry[StepKind.VALIDATE]).toBe(validate);
    expect(registry[StepKind.TRANSFORM]).toBe(transform);
    expect(registry[StepKind.DISPATCH]).toBe(dispatch);
    expect(registry[StepKind.LOG]).toBe(log);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- step-executor.registry.spec.ts`
Expected: FAIL with "Cannot find module './step-executor.registry'"

- [ ] **Step 7: Write the registry and its DI provider**

```ts
// src/infrastructure/execution/step-executor.registry.ts
import { Provider } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { STEP_EXECUTOR_REGISTRY } from '@/application/tokens';
import { StepExecutor } from './step-executor';
import { ReceiveStepExecutor } from './receive-step.executor';
import { ValidateStepExecutor } from './validate-step.executor';
import { TransformStepExecutor } from './transform-step.executor';
import { DispatchStepExecutor } from './dispatch-step.executor';
import { LogStepExecutor } from './log-step.executor';

export type StepExecutorRegistry = Record<StepKind, StepExecutor>;

export function buildStepExecutorRegistry(
  receive: ReceiveStepExecutor,
  validate: ValidateStepExecutor,
  transform: TransformStepExecutor,
  dispatch: DispatchStepExecutor,
  log: LogStepExecutor,
): StepExecutorRegistry {
  return {
    [StepKind.RECEIVE]: receive,
    [StepKind.VALIDATE]: validate,
    [StepKind.TRANSFORM]: transform,
    [StepKind.DISPATCH]: dispatch,
    [StepKind.LOG]: log,
  };
}

export const stepExecutorRegistryProvider: Provider = {
  provide: STEP_EXECUTOR_REGISTRY,
  useFactory: buildStepExecutorRegistry,
  inject: [
    ReceiveStepExecutor,
    ValidateStepExecutor,
    TransformStepExecutor,
    DispatchStepExecutor,
    LogStepExecutor,
  ],
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- step-executor.registry.spec.ts`
Expected: PASS

- [ ] **Step 9: Write StepExecutorModule**

```ts
// src/infrastructure/execution/step-executor.module.ts
import { Module } from '@nestjs/common';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { STEP_EXECUTOR_REGISTRY } from '@/application/tokens';
import { ReceiveStepExecutor } from './receive-step.executor';
import { ValidateStepExecutor } from './validate-step.executor';
import { TransformStepExecutor } from './transform-step.executor';
import { DispatchStepExecutor } from './dispatch-step.executor';
import { LogStepExecutor } from './log-step.executor';
import { stepExecutorRegistryProvider } from './step-executor.registry';

@Module({
  imports: [LogEntryModule],
  providers: [
    ReceiveStepExecutor,
    ValidateStepExecutor,
    TransformStepExecutor,
    DispatchStepExecutor,
    LogStepExecutor,
    stepExecutorRegistryProvider,
  ],
  exports: [STEP_EXECUTOR_REGISTRY],
})
export class StepExecutorModule {}
```

- [ ] **Step 10: Commit**

```bash
git add src/infrastructure/execution/log-step.executor.ts src/infrastructure/execution/log-step.executor.spec.ts src/infrastructure/execution/step-executor.registry.ts src/infrastructure/execution/step-executor.registry.spec.ts src/infrastructure/execution/step-executor.module.ts
git commit -m "feat: add LogStepExecutor and StepExecutorRegistry"
```

---

### Task 17: Queue module (BullMQ root + pipeline-execution queue)

**Files:**
- Create: `src/infrastructure/queue/queue.module.ts`
- Test: `src/infrastructure/queue/queue.module.spec.ts`

**Interfaces:**
- Consumes: `REDIS_URL` env var, `PIPELINE_EXECUTION_QUEUE` token (Task 2).
- Produces: `QueueModule` — a global-ready module exporting `BullModule`'s registered `pipeline-execution` queue, importable by `AppModule` (Task 26), Task 18's `PipelineExecutionModule`, and Task 24's `ExecutionsModule` (which injects the queue via `@InjectQueue`).

**Note:** this test requires a reachable Redis instance (per spec Non-goals, no in-memory Redis substitute is introduced). Run it only when `REDIS_URL` points at a real Redis (e.g. `redis://localhost:6379` via `docker run -p 6379:6379 redis`); skip locally otherwise and rely on Task 18/24's mocked-queue unit tests for coverage that doesn't need Redis.

- [ ] **Step 1: Write the failing test**

```ts
// src/infrastructure/queue/queue.module.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PIPELINE_EXECUTION_QUEUE } from '@/application/tokens';
import { QueueModule } from './queue.module';

describe('QueueModule', () => {
  it('registers the pipeline-execution queue', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), QueueModule],
    }).compile();

    const queue = moduleRef.get<Queue>(getQueueToken(PIPELINE_EXECUTION_QUEUE));

    expect(queue.name).toBe(PIPELINE_EXECUTION_QUEUE);

    await moduleRef.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- queue.module.spec.ts`
Expected: FAIL with "Cannot find module './queue.module'"

- [ ] **Step 3: Write the implementation**

```ts
// src/infrastructure/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PIPELINE_EXECUTION_QUEUE } from '@/application/tokens';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: PIPELINE_EXECUTION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 5000 },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [ ] **Step 4: Run test to verify it passes (requires Redis reachable at REDIS_URL)**

Run: `REDIS_URL=redis://localhost:6379 npm test -- queue.module.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/queue/queue.module.ts src/infrastructure/queue/queue.module.spec.ts
git commit -m "feat: add BullMQ QueueModule with pipeline-execution queue"
```

---

### Task 18: PipelineExecutionProcessor + PipelineExecutionModule

**Files:**
- Create: `src/infrastructure/queue/pipeline-execution.processor.ts`
- Create: `src/infrastructure/queue/pipeline-execution.module.ts`
- Test: `src/infrastructure/queue/pipeline-execution.processor.spec.ts`

**Interfaces:**
- Consumes: `GetExecutionByIdUseCase`, `UpdateExecutionUseCase` (Task 6/12), `GetPipelineByIdUseCase` (Task 4/10), `STEP_EXECUTOR_REGISTRY` (Task 16), `LOGGER_PORT` (Task 13).
- Produces: `PipelineExecutionProcessor` (a BullMQ `WorkerHost` processing `{ executionId: string }` jobs) — the class Task 24's `ExecutionsController` enqueues jobs for. Tested here directly (no real Redis/Mongo) by constructing it with fakes and calling `.process(job)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/infrastructure/queue/pipeline-execution.processor.spec.ts
import { Job } from 'bullmq';
import { StepKind, PipelineStatus } from '@/@types/enums';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step, StepResult } from '@/domain/entities/step';
import { Execution } from '@/domain/entities/execution';
import { StepExecutor } from '@/infrastructure/execution/step-executor';
import { StepExecutorRegistry } from '@/infrastructure/execution/step-executor.registry';
import { PipelineExecutionProcessor } from './pipeline-execution.processor';

function buildProcessor(overrides: {
  pipeline: Pipeline;
  execution: Execution;
  executors: StepExecutorRegistry;
}) {
  const getExecutionById = { execute: jest.fn().mockResolvedValue(overrides.execution) };
  const updateExecution = { execute: jest.fn().mockResolvedValue(overrides.execution) };
  const getPipelineById = { execute: jest.fn().mockResolvedValue(overrides.pipeline) };
  const logger = { log: jest.fn().mockResolvedValue(undefined) };

  const processor = new PipelineExecutionProcessor(
    getExecutionById as any,
    updateExecution as any,
    getPipelineById as any,
    overrides.executors,
    logger as any,
  );

  return { processor, updateExecution, logger };
}

describe('PipelineExecutionProcessor', () => {
  const step = new Step('s1', StepKind.LOG, {
    kind: StepKind.LOG,
    level: 'info',
  });
  const pipeline = new Pipeline('p1', [step], PipelineStatus.IDLE);
  const execution = new Execution(
    'e1',
    'p1',
    'PENDING',
    new Date('2026-01-01T00:00:00.000Z'),
  );

  it('marks the execution COMPLETED when every step succeeds', async () => {
    const succeeding: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s1', 'SUCCESS', {}, new Date())),
    };
    const { processor, updateExecution } = buildProcessor({
      pipeline,
      execution,
      executors: { [StepKind.LOG]: succeeding } as any,
    });

    await processor.process({ data: { executionId: 'e1' } } as Job);

    const finalCall = updateExecution.execute.mock.calls.at(-1)[0];
    expect(finalCall.status).toBe('COMPLETED');
  });

  it('marks the execution FAILED when a step fails', async () => {
    const failing: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s1', 'FAILED', {}, new Date())),
    };
    const { processor, updateExecution } = buildProcessor({
      pipeline,
      execution,
      executors: { [StepKind.LOG]: failing } as any,
    });

    await processor.process({ data: { executionId: 'e1' } } as Job);

    const finalCall = updateExecution.execute.mock.calls.at(-1)[0];
    expect(finalCall.status).toBe('FAILED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pipeline-execution.processor.spec.ts`
Expected: FAIL with "Cannot find module './pipeline-execution.processor'"

- [ ] **Step 3: Write the processor**

```ts
// src/infrastructure/queue/pipeline-execution.processor.ts
import { Inject, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GetExecutionByIdUseCase } from '@/application/use-cases/execution/get-execution-by-id.use-case';
import { UpdateExecutionUseCase } from '@/application/use-cases/execution/update-execution.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { LoggerPort } from '@/application/ports/logger.port';
import { LOGGER_PORT, PIPELINE_EXECUTION_QUEUE, STEP_EXECUTOR_REGISTRY } from '@/application/tokens';
import { StepExecutorRegistry } from '@/infrastructure/execution/step-executor.registry';

export type PipelineExecutionJobData = { executionId: string };

@Injectable()
@Processor(PIPELINE_EXECUTION_QUEUE)
export class PipelineExecutionProcessor extends WorkerHost {
  constructor(
    private readonly getExecutionById: GetExecutionByIdUseCase,
    private readonly updateExecution: UpdateExecutionUseCase,
    private readonly getPipelineById: GetPipelineByIdUseCase,
    @Inject(STEP_EXECUTOR_REGISTRY)
    private readonly executors: StepExecutorRegistry,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {
    super();
  }

  async process(job: Job<PipelineExecutionJobData>): Promise<void> {
    const execution = await this.getExecutionById.execute({
      id: job.data.executionId,
    });
    if (!execution) {
      throw new Error(`Execution ${job.data.executionId} not found`);
    }

    const pipeline = await this.getPipelineById.execute({
      id: execution.pipelineId,
    });
    if (!pipeline) {
      throw new Error(`Pipeline ${execution.pipelineId} not found`);
    }

    execution.updateExecutionStatus('RUNNING');
    await this.persist(execution);

    let payload: unknown = {};
    let index = 0;
    let step = pipeline.getCurrentStep(0);

    while (step) {
      const executor = this.executors[step.kind];
      const result = await executor.execute(step, payload);

      await this.logger.log(
        result.status === 'FAILED' ? 'error' : 'info',
        `Step ${step.id} (${step.kind}) ${result.status}`,
        undefined,
        execution.id,
      );

      if (result.status === 'FAILED') {
        pipeline.markFailed(index, `Step ${step.id} failed`);
        execution.updateExecutionStatus('FAILED');
        await this.persist(execution);
        return;
      }

      payload = result.payload;
      step = pipeline.nextStep(index);
      index += 1;
    }

    pipeline.markCompleted();
    execution.updateExecutionStatus('COMPLETED');
    await this.persist(execution);
  }

  private async persist(execution: {
    id: string;
    pipelineId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    startedAt: Date;
    completedAt?: Date;
  }): Promise<void> {
    await this.updateExecution.execute({
      id: execution.id,
      pipelineId: execution.pipelineId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pipeline-execution.processor.spec.ts`
Expected: PASS

- [ ] **Step 5: Write PipelineExecutionModule**

```ts
// src/infrastructure/queue/pipeline-execution.module.ts
import { Module } from '@nestjs/common';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { StepExecutorModule } from '@/infrastructure/execution/step-executor.module';
import { QueueModule } from './queue.module';
import { PipelineExecutionProcessor } from './pipeline-execution.processor';

@Module({
  imports: [ExecutionModule, PipelineModule, StepExecutorModule, QueueModule],
  providers: [PipelineExecutionProcessor],
})
export class PipelineExecutionModule {}
```

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/queue/pipeline-execution.processor.ts src/infrastructure/queue/pipeline-execution.processor.spec.ts src/infrastructure/queue/pipeline-execution.module.ts
git commit -m "feat: add PipelineExecutionProcessor and PipelineExecutionModule"
```

---

### Task 19: SchemaAdapter refactor into a pure JSON mapper

**Files:**
- Modify: `src/@types/schema.ts`
- Modify: `src/adapters/schema.ts`
- Test: `src/adapters/schema.spec.ts`

**Interfaces:**
- Consumes: `Pipeline` (Task 4), `Step` (`@/domain/entities/step`).
- Produces: `Schema` type = `{ pipeline: PipelineJSON }` (a plain-data shape, not the `Pipeline` class — a class type can't be assigned a structurally-equal JSON literal from HTTP/WS bodies because of its private `steps` field, so the wire type is data-only). `SchemaAdapter.toSchema(pipeline): Schema` and `SchemaAdapter.toPipelineInput(schema): { name?, description?, steps: Step[] }` — consumed by Task 21 (`IntegrationsController`) and Task 22 (`IntegrationsGateway`). The adapter no longer instantiates use cases itself (previously it called `new GetPipelineByIdUseCase(...)` internally); orchestration moves to the controller/gateway.

- [ ] **Step 1: Write the failing test**

```ts
// src/adapters/schema.spec.ts
import { StepKind, PipelineStatus } from '@/@types/enums';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';
import { SchemaAdapter } from './schema';

describe('SchemaAdapter', () => {
  const adapter = new SchemaAdapter();

  it('toSchema converts a Pipeline entity to a JSON-safe Schema', () => {
    const pipeline = new Pipeline(
      'p1',
      [new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' })],
      PipelineStatus.IDLE,
      'My Pipeline',
      'A description',
    );

    const schema = adapter.toSchema(pipeline);

    expect(schema).toEqual({
      pipeline: {
        id: 'p1',
        name: 'My Pipeline',
        description: 'A description',
        status: PipelineStatus.IDLE,
        steps: [{ id: 's1', kind: StepKind.LOG, config: { kind: StepKind.LOG, level: 'info' } }],
      },
    });
  });

  it('toPipelineInput converts a Schema back to Pipeline constructor input', () => {
    const input = adapter.toPipelineInput({
      pipeline: {
        id: 'p1',
        name: 'My Pipeline',
        status: PipelineStatus.IDLE,
        steps: [{ id: 's1', kind: StepKind.LOG, config: { kind: StepKind.LOG, level: 'info' } }],
      },
    });

    expect(input.name).toBe('My Pipeline');
    expect(input.steps).toHaveLength(1);
    expect(input.steps[0]).toBeInstanceOf(Step);
    expect(input.steps[0].id).toBe('s1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- adapters/schema.spec.ts`
Expected: FAIL (current `SchemaAdapter` requires a `PipelineRepository` constructor argument and has no `toSchema`/`toPipelineInput` methods)

- [ ] **Step 3: Redefine the `Schema` type**

```ts
// src/@types/schema.ts
import { PipelineStatus, StepKind } from '@/@types/enums';
import { StepConfig } from '@/@types/domain';

export type PipelineJSON = {
  id: string;
  name?: string;
  description?: string;
  status: PipelineStatus;
  steps: { id: string; kind: StepKind; config: StepConfig }[];
};

export type Schema = {
  pipeline: PipelineJSON;
};
```

- [ ] **Step 4: Rewrite SchemaAdapter as a pure mapper**

```ts
// src/adapters/schema.ts
import { Injectable } from '@nestjs/common';
import { Schema } from '@/@types/schema';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';

export type PipelineInput = {
  name?: string;
  description?: string;
  steps: Step[];
};

@Injectable()
export class SchemaAdapter {
  toSchema(pipeline: Pipeline): Schema {
    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        status: pipeline.status,
        steps: pipeline
          .getSteps()
          .map((step) => ({ id: step.id, kind: step.kind, config: step.config })),
      },
    };
  }

  toPipelineInput(schema: Schema): PipelineInput {
    return {
      name: schema.pipeline.name,
      description: schema.pipeline.description,
      steps: schema.pipeline.steps.map(
        (step) => new Step(step.id, step.kind, step.config),
      ),
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- adapters/schema.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/@types/schema.ts src/adapters/schema.ts src/adapters/schema.spec.ts
git commit -m "refactor: SchemaAdapter becomes a pure JSON<->Pipeline mapper"
```

---

### Task 20: IntegrationEventsEmitter

**Files:**
- Create: `src/presentation/integrations/integration-events.emitter.ts`
- Test: `src/presentation/integrations/integration-events.emitter.spec.ts`

**Interfaces:**
- Consumes: Node's built-in `events.EventEmitter` (no new dependency).
- Produces: `IntegrationEventsEmitter` with `emit(event, payload)`/`on(event, listener)` — Task 21's controller calls `emit`, Task 22's gateway calls both `emit` (for WS-originated mutations) and `on` (to rebroadcast every mutation, HTTP or WS, to connected sockets).

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/integrations/integration-events.emitter.spec.ts
import { Schema } from '@/@types/schema';
import { PipelineStatus, StepKind } from '@/@types/enums';
import { IntegrationEventsEmitter } from './integration-events.emitter';

const schema: Schema = {
  pipeline: {
    id: 'p1',
    status: PipelineStatus.IDLE,
    steps: [{ id: 's1', kind: StepKind.LOG, config: { kind: StepKind.LOG, level: 'info' } }],
  },
};

describe('IntegrationEventsEmitter', () => {
  it('delivers emitted payloads to registered listeners for that event', () => {
    const emitter = new IntegrationEventsEmitter();
    const listener = jest.fn();

    emitter.on('integration.created', listener);
    emitter.emit('integration.created', schema);

    expect(listener).toHaveBeenCalledWith(schema);
  });

  it('does not deliver to listeners registered for a different event', () => {
    const emitter = new IntegrationEventsEmitter();
    const listener = jest.fn();

    emitter.on('integration.updated', listener);
    emitter.emit('integration.created', schema);

    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- integration-events.emitter.spec.ts`
Expected: FAIL with "Cannot find module './integration-events.emitter'"

- [ ] **Step 3: Write the implementation**

```ts
// src/presentation/integrations/integration-events.emitter.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Schema } from '@/@types/schema';

export type IntegrationEvent =
  | 'integration.created'
  | 'integration.updated'
  | 'integration.deleted';

@Injectable()
export class IntegrationEventsEmitter {
  private readonly emitter = new EventEmitter();

  emit(event: IntegrationEvent, payload: Schema): void {
    this.emitter.emit(event, payload);
  }

  on(event: IntegrationEvent, listener: (payload: Schema) => void): void {
    this.emitter.on(event, listener);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- integration-events.emitter.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presentation/integrations/integration-events.emitter.ts src/presentation/integrations/integration-events.emitter.spec.ts
git commit -m "feat: add IntegrationEventsEmitter"
```

---

### Task 21: IntegrationsController + IntegrationsModule (HTTP CRUD)

**Files:**
- Create: `src/presentation/integrations/dto/integration-request.dto.ts`
- Create: `src/presentation/integrations/integrations.controller.ts`
- Create: `src/presentation/integrations/integrations.module.ts`
- Test: `test/integrations.e2e-spec.ts`

**Interfaces:**
- Consumes: `CreatePipelineUseCase`, `UpdatePipelineUseCase`, `DeletePipelineUseCase`, `GetPipelineByIdUseCase`, `GetAllPipelinesUseCase` (Task 4), `SchemaAdapter` (Task 19), `IntegrationEventsEmitter` (Task 20).
- Produces: `IntegrationsController` at `/integrations` (`POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id`) returning `Schema` JSON. `IntegrationsModule` — imported by `AppModule` (Task 26) and by Task 22's `IntegrationsGateway` module wiring (the gateway lives in the same module so it can share the controller's providers).

- [ ] **Step 1: Write the failing e2e test**

```ts
// test/integrations.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { StepKind } from '@/@types/enums';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { IntegrationsModule } from '@/presentation/integrations/integrations.module';

describe('IntegrationsController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        PipelineModule,
        IntegrationsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates, lists, fetches, updates and deletes an integration', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/integrations')
      .send({
        name: 'My Integration',
        steps: [{ id: 's1', kind: StepKind.LOG, config: { kind: StepKind.LOG, level: 'info' } }],
      })
      .expect(201);

    const id = createResponse.body.pipeline.id;
    expect(createResponse.body.pipeline.name).toBe('My Integration');

    await request(app.getHttpServer())
      .get('/integrations')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/integrations/${id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.pipeline.id).toBe(id);
      });

    await request(app.getHttpServer())
      .patch(`/integrations/${id}`)
      .send({
        name: 'Renamed',
        steps: [{ id: 's1', kind: StepKind.LOG, config: { kind: StepKind.LOG, level: 'error' } }],
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.pipeline.name).toBe('Renamed');
      });

    await request(app.getHttpServer()).delete(`/integrations/${id}`).expect(204);

    await request(app.getHttpServer()).get(`/integrations/${id}`).expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- integrations.e2e-spec.ts`
Expected: FAIL with "Cannot find module '@/presentation/integrations/integrations.module'"

- [ ] **Step 3: Write the request DTOs**

```ts
// src/presentation/integrations/dto/integration-request.dto.ts
import { PipelineStatus, StepKind } from '@/@types/enums';
import { StepConfig } from '@/@types/domain';

export class StepRequestDto {
  id!: string;
  kind!: StepKind;
  config!: StepConfig;
}

export class CreateIntegrationRequestDto {
  name?: string;
  description?: string;
  status?: PipelineStatus;
  steps!: StepRequestDto[];
}

export class UpdateIntegrationRequestDto {
  name?: string;
  description?: string;
  status?: PipelineStatus;
  steps!: StepRequestDto[];
}
```

- [ ] **Step 4: Write the controller**

```ts
// src/presentation/integrations/integrations.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Schema } from '@/@types/schema';
import { Step } from '@/domain/entities/step';
import { CreatePipelineUseCase } from '@/application/use-cases/pipeline/create-pipeline.use-case';
import { UpdatePipelineUseCase } from '@/application/use-cases/pipeline/update-pipeline.use-case';
import { DeletePipelineUseCase } from '@/application/use-cases/pipeline/delete-pipeline.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { GetAllPipelinesUseCase } from '@/application/use-cases/pipeline/get-all-pipelines.use-case';
import { SchemaAdapter } from '@/adapters/schema';
import {
  CreateIntegrationRequestDto,
  UpdateIntegrationRequestDto,
} from './dto/integration-request.dto';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly createPipelineUseCase: CreatePipelineUseCase,
    private readonly updatePipelineUseCase: UpdatePipelineUseCase,
    private readonly deletePipelineUseCase: DeletePipelineUseCase,
    private readonly getPipelineByIdUseCase: GetPipelineByIdUseCase,
    private readonly getAllPipelinesUseCase: GetAllPipelinesUseCase,
    private readonly schemaAdapter: SchemaAdapter,
    private readonly events: IntegrationEventsEmitter,
  ) {}

  @Post()
  async create(@Body() body: CreateIntegrationRequestDto): Promise<Schema> {
    const pipeline = await this.createPipelineUseCase.execute({
      name: body.name,
      description: body.description,
      status: body.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new InternalServerErrorException('Failed to create integration');
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.created', schema);
    return schema;
  }

  @Get()
  async findAll(): Promise<Schema[]> {
    const pipelines = await this.getAllPipelinesUseCase.execute();
    return pipelines.map((pipeline) => this.schemaAdapter.toSchema(pipeline));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Schema> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id });
    if (!pipeline) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    return this.schemaAdapter.toSchema(pipeline);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateIntegrationRequestDto,
  ): Promise<Schema> {
    const pipeline = await this.updatePipelineUseCase.execute({
      id,
      name: body.name,
      description: body.description,
      status: body.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.updated', schema);
    return schema;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id });
    if (!pipeline) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    await this.deletePipelineUseCase.execute({ id });
    this.events.emit('integration.deleted', this.schemaAdapter.toSchema(pipeline));
  }
}
```

- [ ] **Step 5: Write the module**

```ts
// src/presentation/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { SchemaAdapter } from '@/adapters/schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@Module({
  imports: [PipelineModule],
  controllers: [IntegrationsController],
  providers: [SchemaAdapter, IntegrationEventsEmitter],
  exports: [IntegrationEventsEmitter, SchemaAdapter],
})
export class IntegrationsModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:e2e -- integrations.e2e-spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/presentation/integrations/dto src/presentation/integrations/integrations.controller.ts src/presentation/integrations/integrations.module.ts test/integrations.e2e-spec.ts
git commit -m "feat: add Integrations HTTP CRUD controller"
```

---

### Task 22: IntegrationsGateway (WebSocket CRUD + broadcast)

**Files:**
- Create: `src/presentation/integrations/integrations.gateway.ts`
- Modify: `src/presentation/integrations/integrations.module.ts`
- Test: `src/presentation/integrations/integrations.gateway.e2e-spec.ts`

**Interfaces:**
- Consumes: same Pipeline use cases, `SchemaAdapter`, `IntegrationEventsEmitter` as Task 21.
- Produces: `IntegrationsGateway` on namespace `/integrations` with message events `integration:create`, `integration:getAll`, `integration:getById`, `integration:update`, `integration:delete`, plus server broadcasts `integration.created`/`integration.updated`/`integration.deleted` triggered by either transport.

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/integrations/integrations.gateway.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io, Socket } from 'socket.io-client';
import { StepKind } from '@/@types/enums';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { IntegrationsModule } from './integrations.module';

describe('IntegrationsGateway (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let client: Socket;
  let baseUrl: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        PipelineModule,
        IntegrationsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://localhost:${address.port}/integrations`;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  afterEach(() => {
    client?.disconnect();
  });

  it('creates an integration over WS and receives the broadcast', (done) => {
    client = io(baseUrl, { transports: ['websocket'] });

    client.on('connect', () => {
      client.on('integration.created', (schema) => {
        expect(schema.pipeline.name).toBe('WS Integration');
        done();
      });

      client.emit(
        'integration:create',
        {
          name: 'WS Integration',
          steps: [{ id: 's1', kind: StepKind.LOG, config: { kind: StepKind.LOG, level: 'info' } }],
        },
        () => {},
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- integrations.gateway.e2e-spec.ts` (run from `src/`, i.e. `npx jest --config test/jest-e2e.json src/presentation/integrations/integrations.gateway.e2e-spec.ts` since this spec lives under `src/`, matched by the `.e2e-spec.ts$` pattern regardless of directory)
Expected: FAIL with "Cannot find module './integrations.gateway'"

- [ ] **Step 3: Write the gateway**

```ts
// src/presentation/integrations/integrations.gateway.ts
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Schema } from '@/@types/schema';
import { Step } from '@/domain/entities/step';
import { CreatePipelineUseCase } from '@/application/use-cases/pipeline/create-pipeline.use-case';
import { UpdatePipelineUseCase } from '@/application/use-cases/pipeline/update-pipeline.use-case';
import { DeletePipelineUseCase } from '@/application/use-cases/pipeline/delete-pipeline.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { GetAllPipelinesUseCase } from '@/application/use-cases/pipeline/get-all-pipelines.use-case';
import { SchemaAdapter } from '@/adapters/schema';
import {
  CreateIntegrationRequestDto,
  UpdateIntegrationRequestDto,
} from './dto/integration-request.dto';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@WebSocketGateway({ namespace: 'integrations', cors: { origin: '*' } })
export class IntegrationsGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly createPipelineUseCase: CreatePipelineUseCase,
    private readonly updatePipelineUseCase: UpdatePipelineUseCase,
    private readonly deletePipelineUseCase: DeletePipelineUseCase,
    private readonly getPipelineByIdUseCase: GetPipelineByIdUseCase,
    private readonly getAllPipelinesUseCase: GetAllPipelinesUseCase,
    private readonly schemaAdapter: SchemaAdapter,
    private readonly events: IntegrationEventsEmitter,
  ) {}

  afterInit(): void {
    this.events.on('integration.created', (schema) =>
      this.server.emit('integration.created', schema),
    );
    this.events.on('integration.updated', (schema) =>
      this.server.emit('integration.updated', schema),
    );
    this.events.on('integration.deleted', (schema) =>
      this.server.emit('integration.deleted', schema),
    );
  }

  @SubscribeMessage('integration:create')
  async handleCreate(
    @MessageBody() body: CreateIntegrationRequestDto,
  ): Promise<Schema> {
    const pipeline = await this.createPipelineUseCase.execute({
      name: body.name,
      description: body.description,
      status: body.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new WsException('Failed to create integration');
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.created', schema);
    return schema;
  }

  @SubscribeMessage('integration:getAll')
  async handleGetAll(): Promise<Schema[]> {
    const pipelines = await this.getAllPipelinesUseCase.execute();
    return pipelines.map((pipeline) => this.schemaAdapter.toSchema(pipeline));
  }

  @SubscribeMessage('integration:getById')
  async handleGetById(@MessageBody() body: { id: string }): Promise<Schema> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id: body.id });
    if (!pipeline) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    return this.schemaAdapter.toSchema(pipeline);
  }

  @SubscribeMessage('integration:update')
  async handleUpdate(
    @MessageBody() body: { id: string } & UpdateIntegrationRequestDto,
  ): Promise<Schema> {
    const pipeline = await this.updatePipelineUseCase.execute({
      id: body.id,
      name: body.name,
      description: body.description,
      status: body.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.updated', schema);
    return schema;
  }

  @SubscribeMessage('integration:delete')
  async handleDelete(
    @MessageBody() body: { id: string },
    @ConnectedSocket() _client: unknown,
  ): Promise<{ id: string }> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id: body.id });
    if (!pipeline) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    await this.deletePipelineUseCase.execute({ id: body.id });
    this.events.emit('integration.deleted', this.schemaAdapter.toSchema(pipeline));
    return { id: body.id };
  }
}
```

- [ ] **Step 4: Register the gateway in the module**

```ts
// src/presentation/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { SchemaAdapter } from '@/adapters/schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsGateway } from './integrations.gateway';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@Module({
  imports: [PipelineModule],
  controllers: [IntegrationsController],
  providers: [SchemaAdapter, IntegrationEventsEmitter, IntegrationsGateway],
  exports: [IntegrationEventsEmitter, SchemaAdapter],
})
export class IntegrationsModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --config test/jest-e2e.json src/presentation/integrations/integrations.gateway.e2e-spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/presentation/integrations/integrations.gateway.ts src/presentation/integrations/integrations.gateway.e2e-spec.ts src/presentation/integrations/integrations.module.ts
git commit -m "feat: add IntegrationsGateway (WS CRUD + broadcast)"
```

---

### Task 23: LogsController + LogsModule

**Files:**
- Create: `src/presentation/logs/dto/create-log-entry-request.dto.ts`
- Create: `src/presentation/logs/logs.controller.ts`
- Create: `src/presentation/logs/logs.module.ts`
- Test: `test/logs.e2e-spec.ts`

**Interfaces:**
- Consumes: `CreateLogEntryUseCase`, `DeleteLogEntryUseCase`, `GetLogEntryByIdUseCase`, `GetAllLogEntriesUseCase` (Task 7/13).
- Produces: `LogsController` at `/logs` (`POST`, `GET`, `GET /:id`, `DELETE /:id`). `LogsModule` — imported by `AppModule` (Task 26).

- [ ] **Step 1: Write the failing e2e test**

```ts
// test/logs.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { LogsModule } from '@/presentation/logs/logs.module';

describe('LogsController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        LogEntryModule,
        LogsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates, lists, fetches and deletes a log entry', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .send({ level: 'info', message: 'hello' })
      .expect(201)
      .expect((res) => {
        expect(res.body.created).toBe(true);
      });

    const list = await request(app.getHttpServer()).get('/logs').expect(200);
    expect(list.body).toHaveLength(1);

    const id = list.body[0].id;

    await request(app.getHttpServer())
      .get(`/logs/${id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe('hello');
      });

    await request(app.getHttpServer()).delete(`/logs/${id}`).expect(204);

    await request(app.getHttpServer()).get(`/logs/${id}`).expect(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- logs.e2e-spec.ts`
Expected: FAIL with "Cannot find module '@/presentation/logs/logs.module'"

- [ ] **Step 3: Write the request DTO**

```ts
// src/presentation/logs/dto/create-log-entry-request.dto.ts
import { ExecutionId } from '@/@types/IDs';
import { LogLevel } from '@/domain/entities/log-entry';

export class CreateLogEntryRequestDto {
  level!: LogLevel;
  message!: string;
  context?: Record<string, unknown>;
  executionId?: ExecutionId;
}
```

- [ ] **Step 4: Write the controller**

```ts
// src/presentation/logs/logs.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { DeleteLogEntryUseCase } from '@/application/use-cases/log-entry/delete-log-entry.use-case';
import { GetLogEntryByIdUseCase } from '@/application/use-cases/log-entry/get-log-entry-by-id.use-case';
import { GetAllLogEntriesUseCase } from '@/application/use-cases/log-entry/get-all-log-entries.use-case';
import { LogEntry } from '@/domain/entities/log-entry';
import { CreateLogEntryRequestDto } from './dto/create-log-entry-request.dto';

@Controller('logs')
export class LogsController {
  constructor(
    private readonly createLogEntryUseCase: CreateLogEntryUseCase,
    private readonly deleteLogEntryUseCase: DeleteLogEntryUseCase,
    private readonly getLogEntryByIdUseCase: GetLogEntryByIdUseCase,
    private readonly getAllLogEntriesUseCase: GetAllLogEntriesUseCase,
  ) {}

  @Post()
  async create(
    @Body() body: CreateLogEntryRequestDto,
  ): Promise<{ created: boolean }> {
    const created = await this.createLogEntryUseCase.execute(body);
    return { created };
  }

  @Get()
  async findAll(): Promise<LogEntry[]> {
    return this.getAllLogEntriesUseCase.execute();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LogEntry> {
    const logEntry = await this.getLogEntryByIdUseCase.execute({ id });
    if (!logEntry) {
      throw new NotFoundException(`Log entry ${id} not found`);
    }
    return logEntry;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteLogEntryUseCase.execute({ id });
  }
}
```

- [ ] **Step 5: Write the module**

```ts
// src/presentation/logs/logs.module.ts
import { Module } from '@nestjs/common';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { LogsController } from './logs.controller';

@Module({
  imports: [LogEntryModule],
  controllers: [LogsController],
})
export class LogsModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:e2e -- logs.e2e-spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/presentation/logs test/logs.e2e-spec.ts
git commit -m "feat: add Logs HTTP CRUD controller"
```

---

### Task 24: ExecutionsController + ExecutionsModule

**Files:**
- Create: `src/presentation/executions/executions.controller.ts`
- Create: `src/presentation/executions/executions.module.ts`
- Test: `test/executions.e2e-spec.ts`

**Interfaces:**
- Consumes: `CreateExecutionUseCase`, `GetExecutionByIdUseCase`, `GetAllExecutionsUseCase` (Task 6/12), the `pipeline-execution` BullMQ queue via `@InjectQueue` (Task 17).
- Produces: `ExecutionsController` at `/executions` (`POST` returns `202`, `GET`, `GET /:id`). `ExecutionsModule` — imported by `AppModule` (Task 26). The e2e test overrides the queue provider with a fake so it runs without a real Redis (per spec Testing section).

- [ ] **Step 1: Write the failing e2e test**

```ts
// test/executions.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { PIPELINE_EXECUTION_QUEUE } from '@/application/tokens';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { ExecutionsModule } from '@/presentation/executions/executions.module';

describe('ExecutionsController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;
  const fakeQueue = { add: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        ExecutionModule,
        ExecutionsModule,
      ],
    })
      .overrideProvider(getQueueToken(PIPELINE_EXECUTION_QUEUE))
      .useValue(fakeQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates an execution, enqueues a job, and lists/fetches it', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/executions')
      .send({ pipelineId: 'p1' })
      .expect(202);

    expect(createResponse.body.pipelineId).toBe('p1');
    expect(createResponse.body.status).toBe('PENDING');
    const id = createResponse.body.id;

    expect(fakeQueue.add).toHaveBeenCalledWith(
      PIPELINE_EXECUTION_QUEUE,
      { executionId: id },
    );

    await request(app.getHttpServer())
      .get('/executions')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/executions/${id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(id);
      });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- executions.e2e-spec.ts`
Expected: FAIL with "Cannot find module '@/presentation/executions/executions.module'"

- [ ] **Step 3: Write the controller**

```ts
// src/presentation/executions/executions.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateExecutionUseCase } from '@/application/use-cases/execution/create-execution.use-case';
import { GetExecutionByIdUseCase } from '@/application/use-cases/execution/get-execution-by-id.use-case';
import { GetAllExecutionsUseCase } from '@/application/use-cases/execution/get-all-executions.use-case';
import { PIPELINE_EXECUTION_QUEUE } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

export class CreateExecutionRequestDto {
  pipelineId!: string;
}

@Controller('executions')
export class ExecutionsController {
  constructor(
    private readonly createExecutionUseCase: CreateExecutionUseCase,
    private readonly getExecutionByIdUseCase: GetExecutionByIdUseCase,
    private readonly getAllExecutionsUseCase: GetAllExecutionsUseCase,
    @InjectQueue(PIPELINE_EXECUTION_QUEUE) private readonly queue: Queue,
  ) {}

  @Post()
  @HttpCode(202)
  async create(@Body() body: CreateExecutionRequestDto): Promise<Execution> {
    const execution = await this.createExecutionUseCase.execute({
      pipelineId: body.pipelineId,
      status: 'PENDING',
      startedAt: new Date(),
    });
    if (!execution) {
      throw new InternalServerErrorException('Failed to create execution');
    }
    await this.queue.add(PIPELINE_EXECUTION_QUEUE, {
      executionId: execution.id,
    });
    return execution;
  }

  @Get()
  async findAll(): Promise<Execution[]> {
    return this.getAllExecutionsUseCase.execute();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Execution> {
    const execution = await this.getExecutionByIdUseCase.execute({ id });
    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }
    return execution;
  }
}
```

- [ ] **Step 4: Write the module**

```ts
// src/presentation/executions/executions.module.ts
import { Module } from '@nestjs/common';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { ExecutionsController } from './executions.controller';

@Module({
  imports: [ExecutionModule, QueueModule],
  controllers: [ExecutionsController],
})
export class ExecutionsModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e -- executions.e2e-spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/presentation/executions test/executions.e2e-spec.ts
git commit -m "feat: add Executions HTTP controller with queue enqueue"
```

---

### Task 25: DomainExceptionFilter

**Files:**
- Create: `src/presentation/common/domain-exception.filter.ts`
- Modify: `src/main.ts`
- Test: `src/presentation/common/domain-exception.filter.spec.ts`

**Interfaces:**
- Consumes: `DomainError` (`@/base/error`).
- Produces: `DomainExceptionFilter` — maps any `DomainError` subclass (e.g. `StepNotFoundError`, `InvalidPipelineError`) thrown from a controller/gateway to an HTTP status: `*_NOT_FOUND` codes → 404, `INVALID_PIPELINE`/`INVALID_STEP_TRANSITION` → 400, everything else → 500. Registered globally in `main.ts` so any use case that throws a `DomainError` (e.g. Step/Pipeline/Connector/Execution/LogEntry delete use cases) surfaces the right HTTP status without every controller needing its own try/catch.

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/common/domain-exception.filter.spec.ts
import { ArgumentsHost } from '@nestjs/common';
import { StepNotFoundError, InvalidPipelineError } from '@/shared/errors/domain';
import { DomainExceptionFilter } from './domain-exception.filter';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('maps a *_NOT_FOUND error to 404', () => {
    const { host, status, json } = buildHost();

    filter.catch(new StepNotFoundError('Step s1 was not found.'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'STEP_NOT_FOUND',
      message: 'Step s1 was not found.',
    });
  });

  it('maps INVALID_PIPELINE to 400', () => {
    const { host, status } = buildHost();

    filter.catch(new InvalidPipelineError('needs a step'), host);

    expect(status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- domain-exception.filter.spec.ts`
Expected: FAIL with "Cannot find module './domain-exception.filter'"

- [ ] **Step 3: Write the implementation**

```ts
// src/presentation/common/domain-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '@/base/error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = this.resolveStatus(exception);

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }

  private resolveStatus(exception: DomainError): number {
    if (exception.code.endsWith('_NOT_FOUND')) {
      return HttpStatus.NOT_FOUND;
    }
    if (
      exception.code === 'INVALID_PIPELINE' ||
      exception.code === 'INVALID_STEP_TRANSITION'
    ) {
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- domain-exception.filter.spec.ts`
Expected: PASS

- [ ] **Step 5: Register the filter globally**

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './presentation/common/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 6: Commit**

```bash
git add src/presentation/common src/main.ts
git commit -m "feat: add global DomainExceptionFilter"
```

---

### Task 26: Final AppModule wiring + smoke e2e test

**Files:**
- Modify: `src/app.module.ts`
- Test: `test/app.e2e-spec.ts` (extend)

**Interfaces:**
- Consumes: every module built in Tasks 8-24.
- Produces: a fully wired `AppModule` — `ConfigModule` (global), `DatabaseModule`, all five entity feature modules, `PipelineExecutionModule`, and the three presentation modules. This is the module `main.ts` bootstraps.

**Note:** `PipelineExecutionModule` (Task 18) transitively imports `QueueModule`, which needs a reachable Redis at boot (`BullModule.forRootAsync` connects eagerly). The smoke test below only exercises `/integrations` (Mongo-backed, no queue involved) to stay Redis-free; a manual end-to-end check of `POST /executions` actually draining the queue requires running `docker run -p 6379:6379 redis` locally first, per the spec's Non-goals (no CI-Redis requirement).

- [ ] **Step 1: Write the failing smoke test**

Extend the existing `test/app.e2e-spec.ts` file — add a new `describe` block alongside the existing `AppController (e2e)` one (do not remove the existing `/ (GET)` test):

```ts
// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('AppModule wiring (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('serves /integrations end-to-end through the full module graph', async () => {
    const created = await request(app.getHttpServer())
      .post('/integrations')
      .send({
        name: 'Smoke Integration',
        steps: [
          {
            id: 's1',
            kind: 'LOG',
            config: { kind: 'LOG', level: 'info' },
          },
        ],
      })
      .expect(201);

    expect(created.body.pipeline.name).toBe('Smoke Integration');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- app.e2e-spec.ts`
Expected: FAIL (`AppModule` doesn't yet import any of the new modules, so `/integrations` 404s) — this run also requires a reachable Redis at `REDIS_URL` since `AppModule` will import `PipelineExecutionModule` once Step 3 lands; start one locally first if you don't already have one (`docker run -p 6379:6379 redis`).

- [ ] **Step 3: Wire AppModule**

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { StepModule } from './infrastructure/database/step/step.module';
import { PipelineModule } from './infrastructure/database/pipeline/pipeline.module';
import { ConnectorModule } from './infrastructure/database/connector/connector.module';
import { ExecutionModule } from './infrastructure/database/execution/execution.module';
import { LogEntryModule } from './infrastructure/database/log-entry/log-entry.module';
import { PipelineExecutionModule } from './infrastructure/queue/pipeline-execution.module';
import { IntegrationsModule } from './presentation/integrations/integrations.module';
import { LogsModule } from './presentation/logs/logs.module';
import { ExecutionsModule } from './presentation/executions/executions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    StepModule,
    PipelineModule,
    ConnectorModule,
    ExecutionModule,
    LogEntryModule,
    PipelineExecutionModule,
    IntegrationsModule,
    LogsModule,
    ExecutionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `REDIS_URL=redis://localhost:6379 npm run test:e2e -- app.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npm test && REDIS_URL=redis://localhost:6379 npm run test:e2e`
Expected: PASS (all unit tests; e2e tests including the Redis-dependent ones)

- [ ] **Step 6: Commit**

```bash
git add src/app.module.ts test/app.e2e-spec.ts
git commit -m "feat: wire AppModule with all presentation and infrastructure modules"
```

---

## Self-Review Notes

- **Spec coverage:** Integrations HTTP (Task 21) + WS (Task 22) ✓; Logger CRUD (Tasks 7, 13, 23) ✓; Queue for parallel pipeline execution (Tasks 17, 18, 24) ✓; MongoDB persistence for all five entities (Tasks 9-13) ✓; DI retrofit for existing use cases (Tasks 3, 5, 6) ✓; Pipeline metadata + `CreatePipelineUseCase`/`CreateExecutionUseCase` returning entities (Tasks 4, 6) — a deliberate, minimal deviation from the spec's illustrative `boolean`-returning snippets, needed so Tasks 21/24's controllers can return the created resource; documented inline in each task's Interfaces section. Error mapping (Task 25) ✓. `.env`/config (Task 1, 8, 17) ✓.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, compilable code.
- **Type consistency:** `PipelineRepository`, `ExecutionRepository`, `ConnectorRepository`, `StepRepository`, `LogEntryRepository` method names match between Task 7 (port definitions) and every Mongo repository (Tasks 9-13) and every use case (Tasks 3-7). `StepExecutorRegistry`/`STEP_EXECUTOR_REGISTRY` names match between Task 16 (definition) and Task 18 (consumption). `Schema`/`PipelineJSON` shape matches between Task 19 (definition) and Tasks 21-22 (controller/gateway request-response bodies).

