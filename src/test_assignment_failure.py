"""실제 배정 실패 원인과 조치가 반환되는지 검사한다."""
from copy import deepcopy
from scheduler import run_algorithm


def fixture():
    return {'config': {'grades': [1], 'classes': {'1': 1}, 'invigCounts': {'1': {'class': 1}}, 'rules': {}},
            'teachers': [{'id': str(i), 'name': f'교사{i}', 'subject': '영어', 'isMain': True} for i in range(2)],
            'periods': [{'id': 'p1', 'date': '2026-10-28', 'name': '1교시'}],
            'classSubjects': {'p1': {'1': '국어'}}}


def test_failures():
    data = fixture()
    data['teachers'] = []
    result = run_algorithm(data)
    assert result['error_type'] == 'CAPACITY', result
    assert result['validation']['required'] == 1 and result['validation']['available'] == 0
    assert '1회 부족' in result['failure']['summary']
    for field, value, reason in [('isMain', False, '감독 유형 권한 없음'),
                                 ('homeroom', '1-1', '본인 담임학급 배정 금지'),
                                 ('subject', '국어', '본인 담당교과 배정 금지'),
                                 ('absences', {'p1': {'type': 'GRADE', 'target': '1'}}, '해당 시간 결시')]:
        data = fixture()
        for teacher in data['teachers']: teacher[field] = value
        original = deepcopy(data)
        result = run_algorithm(data)
        assert result['error_type'] == 'CONSTRAINT', result
        assert any(reason in row['message'] and '2명' in row['message'] for row in result['failure']['reasons']), result
        assert all(row['action'] and row['target'] for row in result['failure']['reasons'])
        assert '2026-10-28 1교시' in result['failure']['summary']
        assert data == original
    data = fixture()
    data['teachers'] = data['teachers'][:1]
    data['periods'].append({'id': 'p2', 'date': '2026-10-28', 'name': '2교시'})
    data['classSubjects']['p2'] = {'1': '국어'}
    assert '동일 학급 연속 배정 금지' in run_algorithm(data)['failure']['reasons'][0]['message']
    data = fixture()
    data['periods'] = []
    assert run_algorithm(data)['error_type'] == 'INPUT'


if __name__ == '__main__':
    test_failures()
    print('PASS: capacity, role, absence, homeroom, subject, consecutive rules, missing schedule')
