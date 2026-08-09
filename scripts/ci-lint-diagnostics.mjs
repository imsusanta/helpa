import { readFile } from 'node:fs/promises';

const reportPath = process.argv[2];
if (!reportPath) process.exit(0);

const reports = JSON.parse(await readFile(reportPath, 'utf8'));
for (const report of reports) {
  for (const message of report.messages || []) {
    const level = message.severity === 2 ? 'error' : 'warning';
    const title = message.ruleId || 'eslint';
    const body = String(message.message || 'Lint issue')
      .replaceAll('%', '%25')
      .replaceAll('\r', '%0D')
      .replaceAll('\n', '%0A');
    console.log(
      `::${level} file=${report.filePath},line=${message.line || 1},col=${message.column || 1},title=${title}::${body}`
    );
  }
}
