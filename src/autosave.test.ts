import { describe, expect, it, vi } from "vitest";
import { Autosave } from "./autosave";

function makeHarness(delayMs = 20) {
  const statuses: string[] = [];
  const saves: string[] = [];
  const save = vi.fn(async (content: string) => {
    saves.push(content);
  });
  const autosave = new Autosave(save, (s) => statuses.push(s), delayMs);
  return { autosave, save, saves, statuses };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Autosave", () => {
  it("debounces rapid updates into one save", async () => {
    const { autosave, save, saves } = makeHarness();
    autosave.update("a");
    autosave.update("ab");
    autosave.update("abc");
    await sleep(60);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saves).toEqual(["abc"]);
  });

  it("saves again after the debounce window", async () => {
    const { autosave, save, saves } = makeHarness();
    autosave.update("one");
    await sleep(60);
    autosave.update("two");
    await sleep(60);
    expect(save).toHaveBeenCalledTimes(2);
    expect(saves).toEqual(["one", "two"]);
  });

  it("does not save when content is unchanged", async () => {
    const { autosave, save } = makeHarness();
    autosave.markLoaded("same");
    autosave.update("same");
    await sleep(60);
    expect(save).not.toHaveBeenCalled();
  });

  it("flushNow saves pending content immediately", async () => {
    const { autosave, save, saves } = makeHarness(10_000);
    autosave.update("urgent");
    await autosave.flushNow();
    expect(save).toHaveBeenCalledTimes(1);
    expect(saves).toEqual(["urgent"]);
  });

  it("flushNow while a save is in flight queues the newer content", async () => {
    const saves: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const save = vi.fn(async (content: string) => {
      saves.push(content);
      await gate;
    });
    const autosave = new Autosave(save, () => {}, 10);
    autosave.update("first");
    await sleep(40);
    autosave.update("second");
    const flushing = autosave.flushNow();
    release();
    await flushing;
    await sleep(40);
    expect(saves).toEqual(["first", "second"]);
  });

  it("reports error status when save rejects and keeps pending content", async () => {
    const statuses: string[] = [];
    let fail = true;
    const save = vi.fn(async (content: string) => {
      if (fail) throw new Error("disk full");
      return content;
    });
    const autosave = new Autosave(save, (s) => statuses.push(s), 10);
    autosave.update("data");
    await sleep(40);
    expect(statuses).toContain("error");
    fail = false;
    await autosave.flushNow();
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses[statuses.length - 1]).toBe("saved");
  });

  it("flushNow returns false while the save keeps failing so callers can block navigation", async () => {
    const save = vi.fn(async () => {
      throw new Error("disk full");
    });
    const autosave = new Autosave(save, () => {}, 10);
    autosave.update("precious");
    const ok = await autosave.flushNow();
    expect(ok).toBe(false);
    expect(autosave.dirty).toBe(true);
    autosave.update("precious");
    expect(await autosave.flushNow()).toBe(false);
  });

  it("flushNow returns true once everything is saved", async () => {
    const { autosave } = makeHarness(10_000);
    autosave.update("fine");
    expect(await autosave.flushNow()).toBe(true);
    expect(autosave.dirty).toBe(false);
  });
});
