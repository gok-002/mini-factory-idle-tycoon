// Statik oyun dosyalarını www/ klasörüne kopyalar (Capacitor webDir / statik barındırma için).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');
const items = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'src', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const it of items) fs.cpSync(path.join(root, it), path.join(out, it), { recursive: true });

let count = 0;
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : count++; })(out);
console.log('www/ hazır: ' + count + ' dosya');
