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
