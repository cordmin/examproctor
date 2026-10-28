"""실제 배정 실패 원인과 조치가 반환되는지 검사한다."""
from copy import deepcopy
from scheduler import run_algorithm
from validator import generate_verify_data


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
    assert result['failure']['summary'] == '감독 선생님이 최소 1명 더 있어야 지금 조건으로 감독 시간표를 짤 수 있습니다.'
    assert result['validation']['need'] == 1
    # 배정 제한만 풀면 되는 경우: 몇 명이 부족한지, 무엇부터 풀면 되는지 알려 준다.
    data = fixture()
    data['periods'].append({'id': 'p2', 'date': '2026-10-28', 'name': '2교시'})
    data['classSubjects']['p2'] = {'1': '수학'}
    data['teachers'] = data['teachers'][:1]
    data['teachers'][0]['maxPeriods'] = 1
    result = run_algorithm(data)
    assert result['error_type'] == 'CAPACITY' and '최소 1명' in result['failure']['summary'], result
    first = result['failure']['reasons'][0]
    assert '교사0(1시간)' in first['message'] and '이 제한만 풀어도 해결됩니다' in first['action'], first
    # 한 교시에 자리가 선생님보다 많으면 그 교시를 짚고, 2인 감독을 1인으로 줄이는 방법도 알려 준다.
    data = fixture()
    data['config']['invigCounts'] = {'1': {'class': 2}}
    data['teachers'] = data['teachers'][:1]
    reasons = run_algorithm(data)['failure']['reasons']
    assert '10월 28일 1교시에는 감독 자리가 2곳인데, 감독할 수 있는 선생님은 1명뿐입니다.' == reasons[0]['message'], reasons
    assert any('1학년 교실 감독을 2명에서 1명으로 줄이면 이것만으로 해결됩니다.' == r['message'] for r in reasons), reasons
    assert all(r['action'] and r['target'] for r in reasons)
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
        assert result['failure']['summary'] == '10월 28일 1교시 1-1 정감독 자리에 들어갈 수 있는 선생님이 없습니다.', result
        assert data == original
    data = fixture()
    data['teachers'] = data['teachers'][:1]
    data['periods'].append({'id': 'p2', 'date': '2026-10-28', 'name': '2교시'})
    data['classSubjects']['p2'] = {'1': '국어'}
    reasons = run_algorithm(data)['failure']['reasons']
    assert reasons[0]['message'] == '1순위로 풀어 볼 규칙: 동일 학급 연속 배정 금지 (풀면 이 자리에 1명 배정 가능)', reasons
    assert reasons[0]['target'] == 'rules'
    assert len(reasons) == 1   # 추천한 규칙의 '이유' 줄은 겹치므로 뺀다
    # 담임학급·담당교과 두 규칙에 함께 걸리면 하나만 풀어서는 안 되므로 추천하지 않는다.
    data = fixture()
    for teacher in data['teachers']: teacher.update(homeroom='1-1', subject='국어')
    reasons = run_algorithm(data)['failure']['reasons']
    assert not any('순위' in r['message'] for r in reasons) and reasons, reasons
    data = fixture()
    data['periods'] = []
    assert run_algorithm(data)['error_type'] == 'INPUT'
    # 배정 검증의 모든 검사 카드에 해결 방법과 바로 가기 화면이 있다.
    checks = generate_verify_data([], [], {}, {}, {})['checks']
    assert all(c['fix'] and c['fix_target'] in ('tab-config', 'tab-teachers', 'tab-absences', 'tab-result', 'rules') for c in checks)


if __name__ == '__main__':
    test_failures()
    print('PASS: teacher shortage in people, relax hints (limits, 2->1 invigilators, rule order), fix hints on every verify check, role, absence, homeroom, subject, consecutive rules, missing schedule')
