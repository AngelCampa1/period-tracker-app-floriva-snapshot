import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');
const excludedFiles = new Set([
  'src/features/app-shell/postOnboardingRouteStorage.ts',
  'src/features/onboarding/draftStorage.ts',
]);
const blockedPattern = /\bv1\b/i;

function collectFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(resolvedPath);
    }

    return entry.isFile() ? [resolvedPath] : [];
  });
}

function shouldCheckFile(relativePath: string): boolean {
  if (excludedFiles.has(relativePath)) {
    return false;
  }

  if (relativePath.startsWith('app/')) {
    return relativePath.endsWith('.tsx');
  }

  if (relativePath.startsWith('src/features/')) {
    return (
      relativePath.includes('/screens/') && relativePath.endsWith('.tsx')
    ) || relativePath.endsWith('/copy.ts');
  }

  if (relativePath.startsWith('src/localization/messages/')) {
    return relativePath.endsWith('.ts');
  }

  return false;
}

describe('user-facing app copy versioning', () => {
  it('keeps app source files free of internal release labels', () => {
    const filesToCheck = [
      ...collectFiles(path.join(projectRoot, 'app')),
      ...collectFiles(path.join(projectRoot, 'src/features')),
      ...collectFiles(path.join(projectRoot, 'src/localization/messages')),
    ];
    const flaggedFiles = filesToCheck
      .map((filePath) => path.relative(projectRoot, filePath))
      .filter((relativePath) => shouldCheckFile(relativePath))
      .filter((relativePath) =>
        blockedPattern.test(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')),
      );

    expect(flaggedFiles).toEqual([]);
  });
});
