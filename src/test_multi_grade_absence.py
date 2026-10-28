"""누적 학년 결시가 자동 배정과 검증에 모두 적용되는지 검사한다."""
import json
from labels import check_label
from scheduler import run_algorithm
from validator import generate_verify_data


def test_multi_grade_absence():
    data = {
        'config': {'grades': [1, 2, 3], 'classes': {'1': 1, '2': 1, '3': 1},
                   'invigCounts': {str(g): {'class': 1} for g in [1, 2, 3]}},
        'periods': [{'id': 'p1', 'date': '2026-10-28', 'name': '1교시'}],
        'classSubjects': {'p1': {'1': '국어', '2': '국어', '3': '국어'}},
        'teachers': [{'id': f'T{g}', 'name': f'교사{g}', 'subject': '영어', 'isMain': True,
                      'isHallway': True, 'isSpecial': True, 'isSeparated': True,
                      'absences': {'p1': {'type': 'GRADE', 'target': [str(other) for other in [1, 2, 3] if other != g]}}} for g in [1, 2, 3]],
    }
    data = json.loads(json.dumps(data))
    result = run_algorithm(data)
    assert result['success'], result
    for grade in [1, 2, 3]:
        teacher = data['teachers'][grade - 1]
        assert result['assignments'][teacher['id']]['p1'] == f'{grade}-1(정)'
        assert not check_label(teacher, 'p1', f'{grade}-1(정)', data['classSubjects'], {})
        for blocked in [g for g in [1, 2, 3] if g != grade]:
            for label in [f'{blocked}-1(정)', f'{blocked}학년(복)', f'{blocked}학년(특수)', f'{blocked}학년(분리)']:
                assert any(category == '결시' for category, _ in check_label(teacher, 'p1', label, data['classSubjects'], {})), label
    checks = generate_verify_data(data['teachers'], data['periods'], result['assignments'], data['classSubjects'], {})
    assert checks['all_pass'], checks
    result['assignments']['T1']['p1'] = '2-1(정)'
    checks = generate_verify_data(data['teachers'], data['periods'], result['assignments'], data['classSubjects'], {})
    assert any(not check['pass'] and any('결시' in message for message in check['messages']) for check in checks['checks'])
    legacy = {**data['teachers'][0], 'absences': {'p1': {'type': 'GRADE', 'target': '2'}}}
    assert any(category == '결시' for category, _ in check_label(legacy, 'p1', '2-1(정)', {}, {}))


if __name__ == '__main__':
    test_multi_grade_absence()
    print('PASS: cumulative grade restrictions, only allowed grade assigned, all room roles, revalidation, save/load, legacy data')
