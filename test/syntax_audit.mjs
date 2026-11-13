import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(path.join(root, 'frontend')).concat(walk(path.join(root, 'test')));
let errors = 0;

for (const f of files) {
  try {
    const content = fs.readFileSync(f, 'utf-8');
    // Using vm.SourceTextModule or new vm.Script with import detection
    if (f.endsWith('.mjs') || content.includes('import ') || content.includes('export ')) {
      // In Node.js, we can construct a SourceTextModule to validate module syntax
      new vm.SourceTextModule(content, { identifier: f });
    } else {
      new vm.Script(content, { filename: f });
    }
  } catch (err) {
    console.error(`SYNTAX ERROR in ${path.relative(root, f)}:\n`, err.message);
    errors++;
  }
}

console.log(`Instantaneously audited ${files.length} JS/MJS files. Syntax errors: ${errors}`);
if (errors > 0) process.exit(1);
