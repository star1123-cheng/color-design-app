// 終端機示範：node scripts/demo.js "#78A5CE" [scene] [--projection]
import { recommend } from '../src/color/palette.js';
import { isHex } from '../src/color/oklch.js';

const [hex = '#78A5CE', scene = 'slides'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const projection = process.argv.includes('--projection');

if (!isHex(hex)) {
  console.error(`「${hex}」不是合法的 HEX 色碼，例如 "#78A5CE"`);
  process.exit(1);
}

const ROLE_NAMES = { primary: '主色', secondary: '輔色', background: '底色', text: '字色', accent: '點綴色' };
const list = recommend(hex, { scene, projection });

console.log(`選色 ${hex.toUpperCase()}｜場景 ${scene}${projection ? '｜投影模式' : ''}｜共 ${list.length} 組\n`);
list.forEach((p, i) => {
  console.log(`【${i + 1}】${p.name}`);
  for (const [role, c] of Object.entries(p.colors)) {
    const [L, C, H] = c.oklch;
    console.log(`  ${ROLE_NAMES[role].padEnd(3, '　')} ${c.hex}  oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`);
  }
  const { textOnBackground, accentOnBackground } = p.checks.contrast;
  console.log(`  對比度：字色/底色 ${textOnBackground}:1、點綴色/底色 ${accentOnBackground}:1；灰階 L 差 ${p.checks.grayscaleLDiff}`);
  for (const w of p.checks.warnings) console.log(`  ⚠ ${w}`);
  console.log('');
});
