type SaveFn = (content: string) => Promise<unknown>;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private lastSaved: string | null = null;
  private readonly delayMs: number;

  constructor(
    private readonly save: SaveFn,
    private readonly onStatus: (status: SaveStatus) => void,
    delayMs = 600,
  ) {
    this.delayMs = delayMs;
  }

  get dirty(): boolean {
    return this.pending !== null && this.pending !== this.lastSaved;
  }

  markLoaded(content: string): void {
    this.lastSaved = content;
  }

  update(content: string): void {
    this.pending = content;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
    this.onStatus(this.dirty ? "saving" : "saved");
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) {
      this.pending = null;
      this.onStatus("saved");
      return;
    }
    const content = this.pending as string;
    this.pending = null;
    this.onStatus("saving");
    this.chain = this.chain.then(async () => {
      try {
        await this.save(content);
        if (this.lastSaved === null || this.lastSaved !== content) {
          this.lastSaved = content;
        }
        this.onStatus(this.dirty ? "saving" : "saved");
      } catch {
        this.pending = content;
        this.onStatus("error");
      }
    });
  }

  /**
   * Save any pending content immediately. Returns true when everything is
   * saved; false when a save failed and unsaved content is still pending,
   * so callers can refuse to discard the dirty editor.
   */
  async flushNow(): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.dirty) this.flush();
    await this.chain;
    if (this.dirty) {
      this.flush();
      await this.chain;
    }
    return !this.dirty;
  }

  /** Drop any pending unsaved content so a canceled edit is never written. */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
    this.onStatus("idle");
  }
}
