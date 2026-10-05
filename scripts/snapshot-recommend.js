// 輸出固定種子色的推薦結果（不含隨機 id），用來比對修改前後是否一致
// 用法：node scripts/snapshot-recommend.js legacy docs/snapshot-before.json
import { writeFileSync } from 'node:fs';
import { recommend } from '../src/color/palette.js';

const SEEDS = ['#78A5CE', '#D98C6A', '#6BAA75', '#B58BC4', '#C9A24D', '#4F7CAC',
               '#E08A9B', '#7FB5A8', '#9A8C6B', '#5C6BC0', '#C46A4F', '#8FA3B0'];
const legacy = process.argv[2] === 'legacy';
const outPath = process.argv[3];
if (!outPath) { console.error('請指定輸出檔路徑'); process.exit(1); }
const opts = legacy ? { bgFamilies: ['warm'], extendedTypes: false } : {};

const out = SEEDS.map((hex) => ({
  hex,
  teacher: recommend(hex, { mode: 'teacher', scene: 'slides', ...opts }),
  worksheet: recommend(hex, { mode: 'teacher', scene: 'worksheet', ...opts }),
  public: recommend(hex, { mode: 'public', style: '清新', ...opts }),
}));
const strip = (k, v) => (k === 'id' ? undefined : v);
writeFileSync(outPath, JSON.stringify(out, strip, 2) + '\n', 'utf8');
console.log('已寫入', outPath);
