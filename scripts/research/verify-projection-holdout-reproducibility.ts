import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const path = '.private/research/map/projection-pipeline-holdout/study.json';
execFileSync(process.execPath, ['scripts/research/study-projection-pipeline-holdout.ts'], { stdio: 'ignore', timeout: 240_000 });
const before = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
execFileSync(process.execPath, ['scripts/research/study-projection-pipeline-holdout.ts'], { stdio: 'ignore', timeout: 240_000 });
const after = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
for (const report of [before, after]) { delete report.generatedAt; delete report.runtime; }
if (!isDeepStrictEqual(before, after)) throw new Error('R2-B numerical artifacts differ');
await writeFile('.private/research/map/projection-pipeline-holdout/reproducibility.json', JSON.stringify({ inputSha256: after.inputSha256, implementationSha256: after.implementationSha256, exactNumericalMatch: true, ignoredFields: ['generatedAt', 'runtime'], verifiedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
console.log('PASS R2-B exact numerical reproducibility, excluding timestamps and resource measurements');
