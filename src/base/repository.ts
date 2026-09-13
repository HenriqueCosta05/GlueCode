import { Entity } from './entity';

export abstract class Repository<TEntity extends Entity> {
  abstract create(data: TEntity): Promise<TEntity>;
  abstract deleteAll(data: TEntity[]): Promise<void>;
  abstract get(): Promise<TEntity>;
  abstract getById(id: string): Promise<TEntity>;
  abstract getAll(): Promise<TEntity[]>;
}
