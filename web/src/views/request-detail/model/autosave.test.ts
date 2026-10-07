import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaver, type AutosaveSnapshot } from "./autosave";

function setup(saveImpl: () => Promise<string | null>, retriable?: (e: unknown) => boolean) {
  let pending = 0;
  const states: AutosaveSnapshot[] = [];
  const onError = vi.fn();
  const save = vi.fn(async () => {
    const before = pending;
    const at = await saveImpl();
    pending -= before;
    return at;
  });
  const saver = createAutosaver({
    save,
    hasPending: () => pending > 0,
    onChange: (s) => states.push({ ...s }),
    onError,
    retriable,
    now: () => "2026-10-07T05:00:00Z",
  });
  const edit = () => {
    pending += 1;
    saver.schedule();
  };
  return { saver, save, states, onError, edit, pendingCount: () => pending };
}

describe("autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces input 700ms and saves once", async () => {
    const t = setup(async () => "2026-10-07T05:01:00Z");
    t.edit();
    await vi.advanceTimersByTimeAsync(400);
    t.edit();
    await vi.advanceTimersByTimeAsync(400);
    t.edit();
    expect(t.save).not.toHaveBeenCalled();
    expect(t.saver.snapshot().status).toBe("saving");
    await vi.advanceTimersByTimeAsync(699);
    expect(t.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.saver.snapshot()).toEqual({ status: "saved", savedAt: "2026-10-07T05:01:00Z" });
  });

  it("starts idle and walks idle → saving → saved", async () => {
    const t = setup(async () => null);
    expect(t.saver.snapshot().status).toBe("idle");
    t.edit();
    await vi.advanceTimersByTimeAsync(700);
    expect(t.states.map((s) => s.status)).toEqual(["saving", "saved"]);
    expect(t.saver.snapshot().savedAt).toBe("2026-10-07T05:00:00Z");
  });

  it("retries 3 times 1s apart and then succeeds", async () => {
    let calls = 0;
    const t = setup(async () => {
      calls += 1;
      if (calls < 4) throw new Error("offline");
      return "2026-10-07T05:02:00Z";
    });
    t.edit();
    await vi.advanceTimersByTimeAsync(700);
    expect(t.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(t.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.save).toHaveBeenCalledTimes(4);
    expect(t.saver.snapshot().status).toBe("saved");
    expect(t.onError).not.toHaveBeenCalled();
  });

  it("fails after the 3rd retry and reports the error once", async () => {
    const t = setup(async () => {
      throw new Error("offline");
    });
    t.edit();
    await vi.advanceTimersByTimeAsync(700 + 3000);
    expect(t.save).toHaveBeenCalledTimes(4);
    expect(t.saver.snapshot().status).toBe("fail");
    expect(t.onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.save).toHaveBeenCalledTimes(4);
  });

  it("does not retry a non-retriable error", async () => {
    const t = setup(
      async () => {
        throw new Error("conflict");
      },
      () => false,
    );
    t.edit();
    await vi.advanceTimersByTimeAsync(700);
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.saver.snapshot().status).toBe("fail");
    expect(t.onError).toHaveBeenCalledTimes(1);
  });

  it("flush saves at once without waiting for the debounce", async () => {
    const t = setup(async () => null);
    t.edit();
    const done = t.saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(await done).toBe(true);
    expect(t.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.save).toHaveBeenCalledTimes(1);
  });

  it("flush with nothing pending resolves true without saving", async () => {
    const t = setup(async () => null);
    await expect(t.saver.flush()).resolves.toBe(true);
    expect(t.save).not.toHaveBeenCalled();
  });

  it("debounces input that arrives during a save again", async () => {
    let release: () => void = () => undefined;
    const t = setup(
      () =>
        new Promise<string | null>((resolve) => {
          release = () => resolve(null);
        }),
    );
    t.edit();
    await vi.advanceTimersByTimeAsync(700);
    expect(t.save).toHaveBeenCalledTimes(1);
    t.edit();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saver.snapshot().status).toBe("saving");
    await vi.advanceTimersByTimeAsync(699);
    expect(t.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.save).toHaveBeenCalledTimes(2);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saver.snapshot().status).toBe("saved");
    expect(t.pendingCount()).toBe(0);
  });

  it("dispose stops a scheduled save", async () => {
    const t = setup(async () => null);
    t.edit();
    t.saver.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.save).not.toHaveBeenCalled();
  });
});
