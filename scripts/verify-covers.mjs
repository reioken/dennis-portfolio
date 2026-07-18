import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cookie = path.join(os.tmpdir(), 'pf-cookie.txt');
execSync(
  `curl.exe -s -c "${cookie}" -X POST "https://riftcast.app/portfolio/__auth" -d "password=Strictly4TheScythe123-.-&next=/portfolio/" -o NUL`,
);
const html = execSync(
  `curl.exe -s -b "${cookie}" "https://riftcast.app/portfolio/work/"`,
  { encoding: 'utf8', maxBuffer: 10_000_000 },
);
const medias = [...html.matchAll(/\/portfolio\/media\/[^"'\\]+/g)].map((m) => m[0]);
console.log([...new Set(medias)].join('\n'));
fs.unlinkSync(cookie);
