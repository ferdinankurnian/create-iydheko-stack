const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'dist', 'bin', 'index.js');
const shebang = '#!/usr/bin/env node';

let content = fs.readFileSync(filePath, 'utf8');

if (!content.startsWith(shebang)) {
  content = shebang + '\n' + content;
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, '755');
  console.log(`Shebang added to ${filePath}`);
} else {
  console.log(`Shebang already exists in ${filePath}`);
}
