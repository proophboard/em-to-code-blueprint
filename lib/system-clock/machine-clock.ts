import {SystemClock} from "@lib/system-clock/system-clock";

export class MachineClock implements SystemClock {
  public now(): Date {
    return new Date();
  }
}
