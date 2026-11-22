"""Comsi and Apin weekly timetables must read into the same lessons, and kind mismatches are refused."""
import json
from pathlib import Path
from unittest.mock import patch
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'src'))
import excel
import main

SRC = Path(__file__).resolve().parents[2] / 'src'
APIN, COMSI = SRC / '압핀_주간시간표(예시).xlsx', SRC / '컴시간_주간시간표(예시).xlsx'

kind_a, apin = excel.read_timetable(APIN)
kind_c, comsi = excel.read_timetable(COMSI)
assert (kind_a, kind_c) == ('apin', 'comsi')
assert apin == comsi, 'Two formats of the same timetable must give the same lessons'

# 예시 json 명단과 시간표 이름이 같아야 불러오기 시연에서 안내 창이 뜨지 않는다.
example = json.loads((SRC / '시험감독_배정결과(예시).json').read_text(encoding='utf-8-sig'))
assert set(apin) == {t['name'] for t in example['teachers']}

# 김채원: 2학년 과학 21시간 + 금 6교시 창체(학년 0)
kim = apin['김채원']
assert sum(1 for _, _, g in kim if g == 2) == 21
assert [4, 6, 0] in kim
assert excel._lesson_grade('108\n공수') == 1 and excel._lesson_grade('수1 2-10') == 2 and excel._lesson_grade('창체') == 0

api = main.Api.__new__(main.Api)
with patch.object(main.Api, '_ask_open', return_value=[str(COMSI)]):
    assert api.import_timetable('comsi')['success']
    wrong = api.import_timetable('apin')
    assert not wrong['success'] and '컴시간' in wrong['error']
print('PASS: comsi/apin timetables read identically; names match example roster; kind mismatch refused')
