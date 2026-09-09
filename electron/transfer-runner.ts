import { Worker } from 'node:worker_threads';
import path from 'node:path';
/** Heavy parsing, hashing, compression and SQLite transactions stay off the UI thread. */
export class Transfers {
  private worker?: Worker;
  private pending?: {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    cancelable: boolean;
  };
  constructor(private root: string) {}
  run(op: string, args: any, cancelable = false): Promise<any> {
    if (this.pending) return Promise.reject(new Error('Another transfer is running. Please wait.'));
    if (!this.worker) {
      this.worker = new Worker(path.join(__dirname, 'transfer-worker.cjs'), {
        workerData: { root: this.root },
        resourceLimits: { maxOldGenerationSizeMb: 1024 },
      });
      const worker = this.worker;
      this.worker.on('message', (message) => {
        if (this.worker !== worker) return;
        const pending = this.pending;
        this.pending = undefined;
        if (message.error) pending?.reject(new Error(message.error));
        else pending?.resolve(message.result);
      });
      this.worker.on('error', (error) => {
        if (this.worker !== worker) return;
        this.pending?.reject(error);
        this.pending = undefined;
        this.worker = undefined;
      });
    }
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, cancelable };
      this.worker!.postMessage({ op, args });
    });
  }
  async close() {
    await this.worker?.terminate();
    this.worker = undefined;
  }
  async cancel() {
    if (!this.pending?.cancelable) return;
    const pending = this.pending;
    this.pending = undefined;
    const worker = this.worker;
    this.worker = undefined;
    await worker?.terminate();
    pending.reject(new Error('Preparation canceled. Select the file again to continue.'));
  }
}
