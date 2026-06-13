import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Manager may run in Docker where claude/git aren't available — keep off by default there.
const AUTO_EXECUTE = (process.env.AUTO_EXECUTE ?? '1') !== '0';

// On approval, fire a focused headless cycle that executes just this task.
// Detached so it survives request lifetime; the shared lock prevents overlap
// with the hourly scheduler.
export function triggerExecution(taskId: string): void {
  if (!AUTO_EXECUTE) return;
  const child = spawn('bash', [join(repoRoot, 'scripts', 'run-task.sh'), taskId], {
    cwd: repoRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', (err) => console.error('[runner] spawn failed', err));
  child.unref();
  console.log(`[runner] execution triggered for task ${taskId}`);
}
