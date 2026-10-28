"""자습만 자습 감독으로 배정하고 수업은 일반 과목으로 처리한다."""
from scheduler import run_algorithm


def test_self_study():
    for subject, expected_count in [('자습', 1), ('수업', 3), ('국어', 3), ('', 0)]:
        data = {
            'config': {'grades': [1], 'classes': {'1': 1}, 'hallways': {'1': 1},
                       'rules': {'excludeSubject': False}},
            'teachers': [{'id': str(i), 'name': f'교사{i}', 'subject': '영어',
                          'isMain': True, 'isSub': True, 'isHallway': True, 'isClass1': True} for i in range(4)],
            'periods': [{'id': 'p1', 'date': '2026-10-28', 'name': '1교시'}],
            'classSubjects': {'p1': {'1': subject}},
        }
        result = run_algorithm(data)
        if not subject:
            assert result['error_type'] == 'INPUT', result
            continue
        assert result['success'], result
        labels = [periods.get('p1') for periods in result['assignments'].values() if periods.get('p1') not in (None, '', '-')]
        assert len(labels) == expected_count, (subject, labels)
        if subject == '자습':
            assert labels == ['1-1(수업)']
        elif subject:
            assert set(labels) == {'1-1(정)', '1-1(부)', '1학년(복)'}



def test_special_single():
    # 이전 파일에 특수학급 2인 값이 남아 있어도 한 명만 배정한다.
    data = {
        'config': {'grades': [1], 'classes': {'1': 0}, 'special': {'1': 1}, 'separated': {'1': 1},
                   'invigCounts': {'1': {'special': 2, 'separated': 2}}, 'rules': {'excludeSubject': False}},
        'teachers': [{'id': str(i), 'name': f'교사{i}', 'isSpecial': True, 'isSeparated': True, 'isSub': True} for i in range(3)],
        'periods': [{'id': 'p1', 'date': '2026-10-28', 'name': '1교시'}],
        'classSubjects': {'p1': {'1': '국어'}},
    }
    result = run_algorithm(data)
    assert result['success'], result
    labels = [p.get('p1') for p in result['assignments'].values() if p.get('p1') not in (None, '', '-')]
    assert set(labels) == {'1학년(특수)', '1학년(분리)'}, labels
    assert len(labels) == 2, labels

if __name__ == '__main__':
    test_special_single()
    test_self_study()
    print('PASS: self-study, ordinary 수업/exam subjects, optional blank selection')
