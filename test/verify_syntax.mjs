import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const jsFiles = [
  'frontend/js/user/state.js',
  'frontend/js/user/accessibility.js',
  'frontend/js/user/navigation.js',
  'frontend/js/user/gestures.js',
  'frontend/js/user/scanner.js',
  'frontend/js/user/payments.js',
  'frontend/js/user/contacts.js',
  'frontend/js/user/tutorial.js',
  'frontend/js/user/app.js',
  'frontend/service-worker.js'
];

let errors = 0;

console.log('=== ES Module Syntax Compilation Validation ===');

for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    // Compile as ES module to verify syntax
    new vm.SourceTextModule(code, {
      identifier: file,
      context: vm.createContext({})
    });
    console.log(`  [VALID] ${file}`);
  } catch (err) {
    console.error(`  [SYNTAX ERROR] in ${file}:`, err.message);
    errors++;
  }
}

if (errors === 0) {
  console.log('\nAll 10 JavaScript files compiled with zero syntax errors.');
} else {
  console.error(`\nFound ${errors} syntax errors.`);
  process.exit(1);
}
