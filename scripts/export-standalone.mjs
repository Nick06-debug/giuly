import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// All artwork, fonts and sound are procedural. Embed the bundle so the gift
// can also be opened directly as a local HTML file, without a web server.
const root = resolve(import.meta.dirname, '..');
let html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const script = html.match(/<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Missing production script or stylesheet');
const assetPath = path => resolve(root, 'dist', path.replace(/^\.\//, ''));
const javascript = await readFile(assetPath(script[1]), 'utf8');
const css = await readFile(assetPath(stylesheet[1]), 'utf8');
const icon = await readFile(resolve(root, 'public/favicon.svg'));
html = html.replace(script[0], () => `<script type="module">${javascript.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace(/(<link[^>]*\brel="icon"[^>]*\bhref=")[^"]+("[^>]*>)/, `$1data:image/svg+xml;base64,${icon.toString('base64')}$2`);
await writeFile(resolve(root, 'dist/Giuly.html'), html);
console.log('Regalo pronto: dist/Giuly.html (autonomo, senza installazione).');
