export function main(): void {
  const startedAt = new Date().toISOString();

  process.stdout.write(`Zen bot bootstrap ready (${startedAt})\n`);
}

main();
