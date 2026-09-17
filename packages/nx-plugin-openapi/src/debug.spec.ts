import { mkdtempSync, writeFileSync, chmodSync } from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join, delimiter } from 'path';

it('debug core spawn stdout', async () => {
  const binDir = mkdtempSync(join(tmpdir(), 'dbg-'));
  const scriptPath = join(binDir, 'npx');
  writeFileSync(scriptPath, '#!/usr/bin/env bash\necho FAKE_SCRIPT_RAN\nexit 3\n');
  chmodSync(scriptPath, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = binDir + delimiter + oldPath;

  await new Promise<void>((resolve) => {
    const child = spawn('npx', ['foo'], { stdio: 'pipe' });
    child.stdout?.on('data', (d) => console.log('STDOUT:', d.toString()));
    child.stderr?.on('data', (d) => console.log('STDERR:', d.toString()));
    child.on('exit', (c) => { console.log('exit', c); resolve(); });
    child.on('error', (e) => { console.log('error', e); resolve(); });
  });

  process.env.PATH = oldPath;
}, 15000);
