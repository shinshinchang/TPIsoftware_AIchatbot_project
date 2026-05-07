import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');

if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
}

for (const fileName of ['manifest.json', 'background.js', 'content.js']) {
  const sourcePath = resolve(root, fileName);
  const targetPath = resolve(dist, fileName);
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}