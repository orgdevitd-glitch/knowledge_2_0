export interface IdGenerator {
  next(prefix?: string): string;
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly seed = "id") {}

  next(prefix = this.seed): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }
}
