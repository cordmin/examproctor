"""시험 시간의 교실은 정·부, 복도는 한 구역으로 표기되어야 한다 (담당교과 금지를 끈 극한 상황 포함)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'src'))
import main  # noqa: F401  (src 경로 확인)
from labels import parse_label, role_key
from scheduler import run_algorithm


def teacher(i, subject):
    return {'id': f'T{i}', 'name': f'교사{i}', 'subject': subject, 'homeroom': '', 'notes': '', 'absences': {}, 'maxPeriods': 0,
            'isMain': True, 'isSub': True, 'isHallway': True, 'isSeparated': True, 'isSpecial': True,
            'isClass1': True, 'isClass2': True, 'isClass3': True}


subjects = ['국어'] * 10 + ['수학'] * 10 + [''] * 10
teachers = [teacher(i, subject) for i, subject in enumerate(subjects)]
periods = [{'id': 'p1', 'date': '2026-05-26', 'name': '1교시'}, {'id': 'p2', 'date': '2026-05-26', 'name': '2교시'}]
data = {
    'config': {'grades': [2], 'classes': {'2': 4}, 'special': {'2': 1}, 'separated': {'2': 1}, 'hallways': {'2': 6},
               'invigCounts': {'2': {'class': 2}},
               'rules': {'excludeSubject': False, 'excludeHomeroom': False, 'excludeSameClass': False,
                         'excludeClassConsecutive': False, 'excludeHallwayConsecutive': False}},
    'teachers': teachers, 'periods': periods,
    'classSubjects': {'p1': {'2': '국어'}, 'p2': {'2': '자습'}},
}
for _ in range(20):
    result = run_algorithm(data)
    assert result['success'], result
    exam = [row['p1'] for row in result['assignments'].values() if 'p1' in row]
    study = [row['p2'] for row in result['assignments'].values() if 'p2' in row]
    rooms = [label for label in exam if label[0].isdigit() and '-' in label.split('(')[0]]
    assert len(rooms) == 8 and all(parse_label(label)[1] in ('정', '부') for label in rooms), rooms
    assert sorted(parse_label(label)[1] for label in rooms) == ['부'] * 4 + ['정'] * 4, rooms
    halls = [label for label in exam if '복' in label]
    assert len(halls) == 6 and all(role_key(label) == '복도' and '(수업)' not in label for label in halls), halls
    assert all(parse_label(label)[0].startswith('2학년(복') and parse_label(label)[1] in '123456' for label in halls), halls
    assert all('(수업)' in label for label in study if '-' in label), study
    others = [label for label in exam + study if '특수' in label or '분리' in label]
    assert all('(수업)' not in label for label in others), others
print('PASS: exam rooms keep main/sub labels and hallway labels stay in one area')
