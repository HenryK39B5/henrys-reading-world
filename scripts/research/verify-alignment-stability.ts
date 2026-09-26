import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const path = '.private/research/map/alignment-stability/study.json';
execFileSync(process.execPath, ['scripts/research/study-alignment-stability.ts'], { stdio: 'ignore', timeout: 300_000 });
const first = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
execFileSync(process.execPath, ['scripts/research/study-alignment-stability.ts'], { stdio: 'ignore', timeout: 300_000 });
const second = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
for (const report of [first, second]) { delete report.generatedAt; delete report.runtime; }
if (!isDeepStrictEqual(first, second)) throw new Error('R3-A numerical artifacts differ');
await writeFile('.private/research/map/alignment-stability/reproducibility.json', JSON.stringify({ inputSha256: second.inputSha256, implementationSha256: second.implementationSha256, exactNumericalMatch: true, ignoredFields: ['generatedAt', 'runtime'], verifiedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
console.log('PASS R3-A exact numerical reproducibility, excluding timestamp and resource measurements');
