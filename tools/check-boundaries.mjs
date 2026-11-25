import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientLibraries =
  /^(?:@proofbase\/(?:sdk|prover)(?:\/|$)|libsodium(?:-|$)|snarkjs(?:\/|$)|circomlibjs(?:\/|$))/;
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/;

export function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', 'dist', '.local', '.git'].includes(entry.name))
      return [];
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('Source symlinks are not allowed');
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

export function checkBoundaries(root) {
  const issues = [];
  const packages = ['apps', 'packages'].flatMap((group) =>
    readdirSync(resolve(root, group)).map((name) => {
      const dir = resolve(root, group, name);
      return {
        dir,
        ...JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')),
      };
    }),
  );
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  for (const pkg of packages) {
    const fixedDomains = {
      '@proofbase/api': 'platform',
      '@proofbase/worker': 'platform',
      '@proofbase/admin': 'platform',
      '@proofbase/core': 'public',
      '@proofbase/verifier': 'public',
      '@proofbase/sdk': 'client',
      '@proofbase/prover': 'client',
      '@proofbase/web': 'client',
    };
    if (
      fixedDomains[pkg.name] &&
      fixedDomains[pkg.name] !== pkg.proofbase?.domain
    )
      issues.push(`${pkg.name}: invalid trust domain`);
    const trusted = ['platform', 'public'].includes(pkg.proofbase?.domain);
    if (!['client', 'platform', 'public'].includes(pkg.proofbase?.domain))
      issues.push(`${pkg.name}: missing trust domain`);
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    };
    function visit(name, visited = new Set(), parent = pkg.name) {
      if (visited.has(name)) return;
      visited.add(name);
      if (
        clientLibraries.test(name) &&
        !(parent === '@proofbase/verifier' && name === 'snarkjs')
      )
        issues.push(`${pkg.name}: forbidden dependency ${name}`);
      const target = byName.get(name);
      if (target?.proofbase.domain === 'client')
        issues.push(`${pkg.name}: client dependency ${name}`);
      for (const child of Object.keys({
        ...target?.dependencies,
        ...target?.optionalDependencies,
      }))
        visit(child, visited, name);
    }
    if (trusted) for (const name of Object.keys(deps)) visit(name);
    for (const path of filesIn(resolve(pkg.dir, 'src')).filter((p) =>
      sourceExtension.test(p),
    )) {
      const content = readFileSync(path, 'utf8');
      // Conservative guard: even comments referencing forbidden imports need review.
      const literals = [...content.matchAll(/['"`]([^'"`\r\n]+)['"`]/g)].map(
        (match) => match[1],
      );
      for (const specifier of literals) {
        if (
          trusted &&
          clientLibraries.test(specifier) &&
          !(pkg.name === '@proofbase/verifier' && specifier === 'snarkjs')
        )
          issues.push(`${pkg.name}: forbidden source import`);
        if (
          specifier.startsWith('.') &&
          !relative(pkg.dir, resolve(path, '..', specifier))
            .split(sep)
            .every((part) => part !== '..')
        )
          issues.push(`${pkg.name}: relative workspace escape`);
        if (
          specifier.startsWith('@proofbase/') &&
          !deps[specifier.split('/').slice(0, 2).join('/')]
        )
          issues.push(`${pkg.name}: undeclared workspace import`);
      }
      if (trusted && /(?:import|require)\s*\(\s*[^'"\s]/.test(content))
        issues.push(`${pkg.name}: computed imports require security review`);
      if (
        pkg.name === '@proofbase/web' &&
        !relative(resolve(pkg.dir, 'src/client'), path).startsWith('..') &&
        !content.startsWith("'use client';")
      )
        issues.push('web: client entry must declare use client');
      if (
        pkg.name === '@proofbase/web' &&
        relative(resolve(pkg.dir, 'src/client'), path).startsWith('..') &&
        literals.some((s) => clientLibraries.test(s))
      )
        issues.push('web: client libraries outside src/client');
    }
  }
  return [...new Set(issues)];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const issues = checkBoundaries(process.cwd());
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else console.log('Workspace trust boundaries: PASS');
}
