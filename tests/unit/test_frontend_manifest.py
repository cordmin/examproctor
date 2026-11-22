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
assert 'Source: "THIRD-PARTY-NOTICES.txt"' in (src / 'installer.iss').read_text(encoding='utf-8'), 'Notices missing from installer'
installer = (src / 'installer.iss').read_text(encoding='utf-8')
for example in ['시험감독_배정결과(예시).json', '압핀_주간시간표(예시).xlsx', '컴시간_주간시간표(예시).xlsx']:
    assert f'Source: "{example}"' in installer, f'Example missing from installer: {example}'
    assert (src / example).is_file(), f'Missing example: {example}'
print('PASS: frontend modules/assets bundled; examples installed next to the program')
