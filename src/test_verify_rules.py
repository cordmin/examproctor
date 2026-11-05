"""선택 규칙의 검증 표시와 실제 위반 판정을 함께 검사한다."""
from validator import generate_verify_data


def test_verify_rules():
    teacher = {'id': 't1', 'name': '교사', 'isMain': True, 'homeroom': '1-1',
               'subject': '국어', 'maxPeriods': 1}
    periods = [{'id': f'p{i}', 'date': '2026-11-06', 'name': f'{i}교시'} for i in (1, 2)]
    assignments = {'t1': {'p1': '1-1(정)', 'p2': '1-1(정)'}}
    off = dict(excludeHomeroom=False, excludeSubject=False, excludeSameClass=False,
               excludeClassConsecutive=False, excludeHallwayConsecutive=False,
               maxConsecutive=99, maxDailyDiff=99)
    result = generate_verify_data([teacher], periods, assignments, {}, off)
    checks = result['checks']
    assert [i + 1 for i, c in enumerate(checks) if c['enabled']] == [1, 2, 3, 4, 10]
    assert not result['all_pass'] and not checks[9]['pass']
    assert checks[9]['targets'] == [['t1', '']]
    teacher['maxPeriods'] = 0
    result = generate_verify_data([teacher], periods, assignments, {}, off)
    assert result['all_pass'] and not result['checks'][9]['enabled']
    on = {**off, 'excludeSameClass': True, 'maxConsecutive': 1, 'excludeClassConsecutive': True}
    result = generate_verify_data([teacher], periods, assignments, {}, on)
    assert not result['all_pass']
    assert not result['checks'][6]['pass'] and result['checks'][6]['enabled']
    assert not result['checks'][8]['pass'] and result['checks'][8]['enabled']
    assert result['checks'][7]['name'] == '8. 수업감독 연속 배정 금지'
    on['excludeClassConsecutive'], on['excludeHallwayConsecutive'] = False, True
    assert generate_verify_data([teacher], periods, assignments, {}, on)['checks'][7]['name'] == '8. 복도감독 연속 배정 금지'
    assert all(c['fix'] and c['fix_target'] for c in result['checks'])


if __name__ == '__main__':
    test_verify_rules()
    print('PASS: disabled rules, applied limits, violations and navigation targets, selected role titles')
