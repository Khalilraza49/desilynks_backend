import { DynamicModule, Inject, Provider } from '@nestjs/common';

const getQueueToken = (name: string) => `BullQueue_${name}`;

const createQueueProvider = (name: string): Provider => ({
  provide: getQueueToken(name),
  useValue: {
    add: async () => undefined,
    addBulk: async () => [],
  },
});

export class BullModule {
  static forRootAsync(): DynamicModule {
    return { module: BullModule };
  }

  static registerQueue(...queues: Array<{ name: string }>): DynamicModule {
    const providers = queues.map(({ name }) => createQueueProvider(name));
    return { module: BullModule, providers, exports: providers };
  }
}

export const InjectQueue = (name: string): ParameterDecorator =>
  Inject(getQueueToken(name));

export const Processor = (): ClassDecorator => () => undefined;

export class WorkerHost {}
