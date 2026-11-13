import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const userHtml = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf-8');
const adminHtml = fs.readFileSync(path.join(root, 'frontend', 'admin.html'), 'utf-8');

function extractIds(html) {
  const idRegex = /id=["']([^"']+)["']/g;
  const ids = new Set();
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

const userIds = extractIds(userHtml);
const adminIds = extractIds(adminHtml);

function checkJsFiles(dir, validIds, htmlName) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const missing = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // match getElementById('...')
    const getByIdRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = getByIdRegex.exec(content)) !== null) {
      const id = match[1];
      if (!validIds.has(id)) {
        missing.push({ file, id, htmlName });
      }
    }

    // match querySelector('#...')
    const queryIdRegex = /querySelector\(['"]#([^'"]+)['"]\)/g;
    while ((match = queryIdRegex.exec(content)) !== null) {
      const id = match[1];
      // strip any subselectors if any
      const cleanId = id.split(/[\s.:>+~]/)[0];
      if (!validIds.has(cleanId)) {
        missing.push({ file, id: cleanId, htmlName, type: 'querySelector' });
      }
    }
  }
  return missing;
}

console.log('=== PALMLOCK DOM Reference Audit ===\n');

const userMissing = checkJsFiles(path.join(root, 'frontend', 'js', 'user'), userIds, 'index.html');
const adminMissing = checkJsFiles(path.join(root, 'frontend', 'js', 'admin'), adminIds, 'admin.html');

console.log(`User Interface missing DOM IDs (${userMissing.length}):`);
userMissing.forEach(m => console.log(`  [USER MISMATCH] ${m.file} requests #${m.id} which is NOT in ${m.htmlName}`));

console.log(`\nAdmin Interface missing DOM IDs (${adminMissing.length}):`);
adminMissing.forEach(m => console.log(`  [ADMIN MISMATCH] ${m.file} requests #${m.id} which is NOT in ${m.htmlName}`));

console.log('\nAudit complete.');
