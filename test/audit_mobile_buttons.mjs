import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf-8');

// Read all user js files
const jsDir = path.join(root, 'frontend', 'js', 'user');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
let allJs = '';
for (const f of jsFiles) {
  allJs += fs.readFileSync(path.join(jsDir, f), 'utf-8') + '\n';
}

// Find all screens in index.html
const screenRegex = /<section[^>]*id=["']([^"']+)["'][^>]*class=["'][^"']*app-screen[^"']*["'][^>]*>([\s\S]*?)<\/section>/g;
let screenMatch;

console.log('=== PALMLOCK Mobile Screen & Button Audit ===\n');

while ((screenMatch = screenRegex.exec(html)) !== null) {
  const screenId = screenMatch[1];
  const screenHtml = screenMatch[2];

  // Find all buttons inside this screen
  const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
  let btnMatch;
  const buttons = [];

  while ((btnMatch = btnRegex.exec(screenHtml)) !== null) {
    const fullTag = btnMatch[0];
    const idMatch = fullTag.match(/id=["']([^"']+)["']/);
    const classMatch = fullTag.match(/class=["']([^"']+)["']/);
    const dataNavMatch = fullTag.match(/data-nav=["']([^"']+)["']/);
    const dataBackMatch = fullTag.match(/data-back=["']([^"']+)["']/);
    const typeMatch = fullTag.match(/type=["']([^"']+)["']/);

    const btnId = idMatch ? idMatch[1] : null;
    const btnClass = classMatch ? classMatch[1] : '';
    const dataNav = dataNavMatch ? dataNavMatch[1] : null;
    const dataBack = dataBackMatch ? dataBackMatch[1] : null;
    const btnType = typeMatch ? typeMatch[1] : 'button';

    // Check if this button has an event listener or handler
    let handled = false;
    let handlerInfo = '';

    if (dataNav) {
      handled = true;
      handlerInfo = `handled via data-nav="${dataNav}"`;
    } else if (dataBack) {
      handled = true;
      handlerInfo = `handled via data-back="${dataBack}"`;
    } else if (btnClass.includes('btn-header-back')) {
      handled = true;
      handlerInfo = 'handled via .btn-header-back';
    } else if (btnType === 'submit') {
      handled = true;
      handlerInfo = 'form submit button';
    } else if (btnId) {
      if (allJs.includes(`'${btnId}'`) || allJs.includes(`"${btnId}"`)) {
        handled = true;
        handlerInfo = `handled via ID #${btnId}`;
      }
    } else {
      // Check class handlers
      const classes = btnClass.split(/\s+/);
      for (const cls of classes) {
        if (cls && (allJs.includes(`.${cls}`) || allJs.includes(`'${cls}'`) || allJs.includes(`"${cls}"`))) {
          handled = true;
          handlerInfo = `handled via class .${cls}`;
          break;
        }
      }
    }

    buttons.push({ btnId, btnClass, handled, handlerInfo, snippet: fullTag.slice(0, 80).replace(/\s+/g, ' ') });
  }

  const unhandled = buttons.filter(b => !b.handled);
  console.log(`Screen: #${screenId} — Total buttons: ${buttons.length}, Unhandled: ${unhandled.length}`);
  if (unhandled.length > 0) {
    unhandled.forEach(u => console.log(`  [UNHANDLED BUTTON] ID: ${u.btnId || 'NO_ID'} | Class: ${u.btnClass} | ${u.snippet}`));
  }
}
