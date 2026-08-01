import type { IsoDateTime } from "./value-objects";
import { toIsoDateTime } from "./value-objects";

export interface Clock {
  now(): IsoDateTime;
}

export class SystemClock implements Clock {
  now(): IsoDateTime {
    return toIsoDateTime(new Date());
  }
}

export class FixedClock implements Clock {
  constructor(private readonly instant: IsoDateTime) {}

  now(): IsoDateTime {
    return this.instant;
  }
}
