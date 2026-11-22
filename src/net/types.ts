import type { Launch } from '../sim/shot';

// Network boundary. Phase 1 ships only LocalTransport (one device, nothing leaves it).
// Phase 2 adds a PartyKit transport behind the same interface: one Durable Object per match,
// clients send Launch records, the server re-runs them with sim/shot.simulateShot.

export type NetMessage =
  | { type: 'shot'; player: string; launch: Launch }
  | { type: 'score'; player: string; total: number }
  | { type: 'power'; player: string; power: string }
  | { type: 'state'; data: unknown };

export interface Transport {
  readonly online: boolean;
  send(msg: NetMessage): void;
  on(fn: (msg: NetMessage) => void): () => void;
  close(): void;
}

/** Same-device play: messages loop straight back. */
export class LocalTransport implements Transport {
  readonly online = false;
  private fns: ((m: NetMessage) => void)[] = [];
  send(msg: NetMessage): void { for (const f of this.fns) f(msg); }
  on(fn: (m: NetMessage) => void): () => void {
    this.fns.push(fn);
    return () => (this.fns = this.fns.filter((f) => f !== fn));
  }
  close(): void { this.fns = []; }
}
