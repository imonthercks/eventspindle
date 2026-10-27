const target = process.argv[2] ?? 'requested target';
console.error(
  `${target} is a planned M1–M6 command; repository bootstrap creates only M0 scaffolding.`,
);
process.exitCode = 2;
