import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await mkdir(resolve(root, 'docs'), { recursive: true });
await copyFile(resolve(root, 'dist/Giuly.html'), resolve(root, 'docs/index.html'));
await writeFile(resolve(root, 'docs/.nojekyll'), '');
console.log('Sito pronto in docs/: index.html autonomo per GitHub Pages.');
