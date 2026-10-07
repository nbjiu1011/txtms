/**
 * Draft autosave state machine (reference `autosave`): saves 700ms after the last input, or at once
 * on a manual save / structural change; a failed save is retried 3 times 1s apart before the state
 * becomes `fail`. Edits that arrive while a save runs are debounced again afterwards. Framework free:
 * timers are injectable so tests can drive them.
 */

export type AutosaveStatus = "idle" | "saving" | "saved" | "fail";

export interface AutosaveSnapshot {
  status: AutosaveStatus;
  /** Time of the last successful save (ISO). */
  savedAt: string | null;
}

export const AUTOSAVE_DEBOUNCE_MS = 700;
export const AUTOSAVE_RETRY_MS = 1000;
export const AUTOSAVE_MAX_RETRIES = 3;
/** Dirty draft tabs are saved at this interval as well. */
export const AUTOSAVE_INTERVAL_MS = 30_000;

export interface AutosaveTimers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const defaultTimers: AutosaveTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface AutosaverOptions {
  /** Saves everything pending; resolves with the server's saved time (or null to use `now`). */
  save: () => Promise<string | null>;
  /** Something is still waiting to be saved. */
  hasPending: () => boolean;
  onChange: (snapshot: AutosaveSnapshot) => void;
  /** Final failure (retries exhausted or a non-retriable error). */
  onError?: (error: unknown) => void;
  /** Errors worth retrying (default: all). */
  retriable?: (error: unknown) => boolean;
  now?: () => string;
  timers?: AutosaveTimers;
  debounceMs?: number;
  retryMs?: number;
  maxRetries?: number;
}

export interface Autosaver {
  /** After an input: shows `saving` and saves once input stops. */
  schedule(): void;
  /** Saves now (manual save, before submit). Resolves true when nothing is left unsaved. */
  flush(): Promise<boolean>;
  snapshot(): AutosaveSnapshot;
  /** Stops timers; pending work is dropped. */
  dispose(): void;
}

export function createAutosaver(options: AutosaverOptions): Autosaver {
  const timers = options.timers ?? defaultTimers;
  const debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
  const retryMs = options.retryMs ?? AUTOSAVE_RETRY_MS;
  const maxRetries = options.maxRetries ?? AUTOSAVE_MAX_RETRIES;
  const retriable = options.retriable ?? (() => true);
  const now = options.now ?? (() => new Date().toISOString());

  let state: AutosaveSnapshot = { status: "idle", savedAt: null };
  let debounce: unknown = null;
  let running: Promise<boolean> | null = null;
  /** Input arrived during a run: debounce again afterwards. */
  let inputDuringRun = false;
  /** A flush was requested during a run: keep saving until nothing is pending. */
  let flushDuringRun = false;
  let disposed = false;

  const set = (next: AutosaveSnapshot) => {
    if (next.status === state.status && next.savedAt === state.savedAt) return;
    state = next;
    options.onChange(state);
  };
  const clearDebounce = () => {
    if (debounce !== null) timers.clear(debounce);
    debounce = null;
  };
  const wait = (ms: number) => new Promise<void>((resolve) => timers.set(resolve, ms));

  const armDebounce = () => {
    clearDebounce();
    debounce = timers.set(() => {
      debounce = null;
      void start();
    }, debounceMs);
  };

  async function cycle(): Promise<boolean> {
    let retries = 0;
    for (;;) {
      if (disposed) return false;
      if (!options.hasPending()) {
        set({ status: state.savedAt ? "saved" : "idle", savedAt: state.savedAt });
        return true;
      }
      set({ status: "saving", savedAt: state.savedAt });
      try {
        const at = await options.save();
        retries = 0;
        state = { ...state, savedAt: at ?? now() };
      } catch (error) {
        if (disposed) return false;
        if (retriable(error) && retries < maxRetries) {
          retries += 1;
          await wait(retryMs);
          continue;
        }
        set({ status: "fail", savedAt: state.savedAt });
        options.onError?.(error);
        return false;
      }
      if (!options.hasPending()) {
        set({ status: "saved", savedAt: state.savedAt });
        return true;
      }
      if (flushDuringRun) {
        flushDuringRun = false;
        continue;
      }
      if (inputDuringRun) {
        inputDuringRun = false;
        armDebounce();
        return true;
      }
    }
  }

  function start(): Promise<boolean> {
    if (running) return running;
    inputDuringRun = false;
    running = cycle().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    schedule() {
      if (disposed) return;
      set({ status: "saving", savedAt: state.savedAt });
      if (running) {
        inputDuringRun = true;
        return;
      }
      armDebounce();
    },
    async flush() {
      if (disposed) return false;
      clearDebounce();
      if (running) {
        flushDuringRun = true;
        const ok = await running;
        if (!ok) return false;
        if (!options.hasPending()) return true;
      }
      return start();
    },
    snapshot: () => state,
    dispose() {
      disposed = true;
      clearDebounce();
    },
  };
}
