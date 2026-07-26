const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'ux-prototypes', 'shared');
const files = fs.readdirSync(dir).filter(f => f.startsWith('agnes-') && f.endsWith('.png'));

async function convert() {
  let total = 0;
  for (const f of files) {
    const src = path.join(dir, f);
    const dest = path.join(dir, f.replace('.png', '.webp'));
    const srcSize = fs.statSync(src).size;
    await sharp(src).webp({ quality: 82 }).toFile(dest);
    const destSize = fs.statSync(dest).size;
    const ratio = ((destSize / srcSize) * 100).toFixed(1);
    console.log(`[OK] ${f} -> ${f.replace('.png', '.webp')} : ${srcSize} -> ${destSize} bytes (${ratio}%)`);
    total++;
  }
  console.log(`\nDone: ${total} files converted`);
}
convert().catch(e => { console.error(e); process.exit(1); });
