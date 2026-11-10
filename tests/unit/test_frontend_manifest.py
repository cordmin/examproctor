"""Every frontend entry must be included in the executable."""
import ast
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
src = ROOT / 'src'
spec = ast.parse((src / '시험감독배정시스템.spec').read_text(encoding='utf-8'))
manifest = next(ast.literal_eval(node.value) for node in spec.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'FRONTEND' for t in node.targets))
html = (src / 'index.html').read_text(encoding='utf-8')
references = re.findall(r'(?:src|href)="([^"#]+\.(?:js|css|png))"', html)
for filename in references:
    assert filename in manifest, f'Missing from executable: {filename}'
for filename in manifest:
    assert (src / filename).is_file(), f'Missing asset: {filename}'
assert '시험감독_배정결과(예시).json' not in (src / 'installer.iss').read_text(encoding='utf-8')
print('PASS: frontend modules/assets bundled; no sample data in installer')
