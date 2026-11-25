import { fork } from 'node:child_process';
import { once } from 'node:events';

// Start the budget after startup, immediately before the engine receives its witness.
export async function timedSample(dir, tmp, limitMs) {
  const child = fork('tools/spike/measure.mjs', [dir, tmp], {
    stdio: ['ignore', 'pipe', 'inherit', 'ipc'],
  });
  let timer,
    expired = false,
    output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    output += chunk;
  });
  child.on('message', (event) => {
    if (event === 'proving')
      timer = setTimeout(() => {
        expired = true;
        child.kill('SIGKILL');
      }, limitMs);
    if (event === 'proved') clearTimeout(timer);
  });
  try {
    const [code] = await once(child, 'close');
    if (expired) return { deadlineMs: limitMs, status: 'timeout' };
    if (code !== 0) throw new Error('benchmark_child_failed');
    return JSON.parse(output);
  } finally {
    clearTimeout(timer);
  }
}
