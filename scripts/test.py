"""Run independent regression checks without opening the user's saved data."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--unit', action='store_true', help='Python checks')
    parser.add_argument('--ui', action='store_true', help='Requires Node, Playwright and Edge')
    args = parser.parse_args()
    suites = []
    if args.unit or not args.ui:
        suites += [(sys.executable, path) for path in sorted((ROOT / 'tests/unit').glob('test_*.py'))]
    if args.ui:
        suites += [('node', path) for path in sorted((ROOT / 'tests/browser').glob('test_*.cjs'))]
    failures = []
    with TemporaryDirectory(prefix='examproctor-tests-') as data_dir:
        env = dict(os.environ, EXAMPROCTOR_DATA_DIR=data_dir, PYTHONIOENCODING='utf-8')
        modules = str(ROOT / '.local/test-tools/node_modules')
        env['NODE_PATH'] = os.pathsep.join(filter(None, [modules, env.get('NODE_PATH')]))
        for command, path in suites:
            print(f'RUN {path.relative_to(ROOT)}', flush=True)
            result = subprocess.run([command, str(path)], cwd=ROOT, env=env, timeout=180)
            if result.returncode:
                failures.append(str(path.relative_to(ROOT)))
    print(f'{len(suites) - len(failures)}/{len(suites)} checks passed', flush=True)
    if failures:
        print('Failed: ' + ', '.join(failures))
    return bool(failures)


if __name__ == '__main__':
    sys.exit(main())
