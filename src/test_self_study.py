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


if __name__ == '__main__':
    test_self_study()
    print('PASS: self-study, ordinary 수업/exam subjects, optional blank selection')
