import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

const path = '.private/research/map/projection-window/study.json';
const before = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
execFileSync(process.execPath, ['scripts/research/study-projection-windows.ts'], { stdio: 'ignore', timeout: 240_000 });
const after = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
for (const value of [before, after]) { delete value.generatedAt; delete value.runtime; }
if (!isDeepStrictEqual(before, after)) throw new Error('R2 numerical artifacts differ; timestamp/resource fields alone may differ');
await writeFile('.private/research/map/projection-window/reproducibility.json', JSON.stringify({
    verifiedAt: new Date().toISOString(), inputSha256: after.inputSha256, embeddingFileSha256: after.embeddingFileSha256,
    implementationSha256: after.implementationSha256, exactNumericalMatch: true, ignoredFields: ['generatedAt', 'runtime'],
}, null, 2) + '\n', 'utf8');
console.log('PASS R2 exact numerical reproducibility; only timestamp and resource fields excluded');
