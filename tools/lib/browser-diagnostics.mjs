import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Retain screenshots and a trace only for contexts involved in a failure. */
export function browserDiagnostics(directory) {
  const contexts = new Set();
  let sequence = 0;
  return {
    async attach(context, label = 'browser') {
      if (!directory) return context;
      mkdirSync(directory, { recursive: true });
      const id = `${++sequence}-${label.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0,100)}`;
      const entry = { context, id, failed: false, pending: [] };
      contexts.add(entry);
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      const close = context.close.bind(context);
      context.close = async () => {
        await Promise.allSettled(entry.pending);
        await context.tracing.stop(entry.failed ? { path: join(directory, `${id}.trace.zip`) } : {}).catch(() => {});
        contexts.delete(entry);
        await close();
      };
      return context;
    },
    capture(label, message) {
      if (!directory) return;
      for (const entry of contexts) {
        entry.failed = true;
        const suffix = `${entry.id}-${++sequence}`;
        writeFileSync(join(directory, `${suffix}.txt`), `${label}\n${message}\n`);
        entry.pending.push(Promise.allSettled(entry.context.pages().map((page, i) =>
          page.screenshot({ path: join(directory, `${suffix}-${i}.png`), timeout: 5000 }))));
      }
    },
  };
}
