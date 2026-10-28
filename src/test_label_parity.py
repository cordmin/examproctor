"""배정 라벨을 다루는 공용 로직 검사.

1) labels.py 와 labels.js 의 라벨 파서가 동일하게 동작하는지 대조.
   두 파서가 어긋나면 화면 표기와 엑셀 표기가 조용히 달라진다.
2) check_label() 의 규칙 판정.
   검증 탭의 사후 검사와 수동 교체 검사가 이 함수 하나를 공유하므로,
   여기서 깨지면 두 곳이 함께 깨진다.

실행:  python test_label_parity.py     (1번 검사에 node 필요)
"""
import json
import os
import shutil
import subprocess
import sys

from labels import ROLE_COL, check_label, grade_of, parse_label, role_key

def build_corpus():
    """run_algorithm 이 실제로 만들어낼 수 있는 라벨을 모두 나열한다."""
    labels = []
    for g in (1, 2, 3):
        for c in (1, 12):
            labels += [f'{g}-{c}(정)', f'{g}-{c}(부)', f'{g}-{c}(수업)']
        for room in ('특수', '분리'):
            labels += [f'{g}학년({room})', f'{g}학년({room})(부)']          # 구역 1개
            for i in (1, 2):
                labels += [f'{g}학년({room}{i})', f'{g}학년({room}{i})(부)']  # 구역 여러 개
        labels.append(f'{g}학년(복)')                                      # 복도 1개
        labels += [f'{g}학년(복{i})' for i in (1, 2)]                      # 복도 여러 개
    return labels


def run_js(parser_src, labels):
    script = parser_src + f'''
const labels = {json.dumps(labels, ensure_ascii=False)};
console.log(JSON.stringify(labels.map(l => {{
    const p = parseLabel(l);
    return [p.area, p.role, roleKey(l), gradeOf(p.area), ROLE_COL[roleKey(l)]];
}})));
'''
    out = subprocess.run([shutil.which('node'), '-e', script],
                         capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def test_check_label():
    """check_label() 의 규칙 판정. 분류만 보고 문구는 보지 않는다."""
    full = {'isMain': True, 'isSub': True, 'isClass1': True, 'isClass2': True,
            'isClass3': True, 'isHallway': True, 'isSeparated': True, 'isSpecial': True}
    subjects = {'p1': {'1': '국어'}}
    on = {'excludeHomeroom': True, 'excludeSubject': True}

    def cats(teacher, label, rules=on, p_id='p1'):
        return sorted(c for c, _ in check_label({**full, **teacher}, p_id, label, subjects, rules))

    # 권한이 다 있고 담임/교과도 안 걸리면 통과
    assert cats({}, '1-3(정)') == []
    assert cats({}, '1학년(복2)') == []

    # 역할별 권한
    assert cats({'isMain': False}, '1-3(정)') == ['권한']
    assert cats({'isSub': False}, '1-3(부)') == ['권한']
    assert cats({'isHallway': False}, '1학년(복)') == ['권한']
    assert cats({'isSeparated': False}, '1학년(분리)') == ['권한']
    assert cats({'isClass1': False}, '1-3(수업)') == ['권한']
    assert cats({'isClass2': False}, '1-3(수업)') == []      # 학년이 다르면 무관

    # 라벨 하나가 복수 권한을 요구하는 경우 둘 다 잡아야 한다
    assert cats({'isSpecial': False}, '1학년(특수)(부)') == ['권한']
    assert cats({'isSpecial': False, 'isSub': False}, '1학년(특수)(부)') == ['권한', '권한']

    # 결시
    assert cats({'absences': {'p1': {'type': 'ALL'}}}, '1-3(정)') == ['결시']
    assert cats({'absences': {'p1': {'type': 'GRADE', 'target': '1'}}}, '1-3(정)') == ['결시']
    assert cats({'absences': {'p1': {'type': 'GRADE', 'target': '2'}}}, '1-3(정)') == []
    assert cats({'absences': {'p1': {'type': 'CLASS', 'target': '1-3'}}}, '1-3(정)') == ['결시']
    assert cats({'absences': {'p1': {'type': 'CLASS', 'target': '1-4'}}}, '1-3(정)') == []
    assert cats({'absences': {'p2': {'type': 'ALL'}}}, '1-3(정)') == []   # 다른 교시

    # 담임학급 / 담당교과 (규칙을 끄면 통과해야 한다)
    off = {'excludeHomeroom': False, 'excludeSubject': False}
    assert cats({'homeroom': '1-3'}, '1-3(정)') == ['담임']
    assert cats({'homeroom': '1-3'}, '1-3(정)', rules=off) == []
    assert cats({'subject': '국어'}, '1-3(정)') == ['교과']
    assert cats({'subject': '국어'}, '1-3(정)', rules=off) == []
    assert cats({'subject': '수학'}, '1-3(정)') == []
    # 규칙 키가 아예 없으면 켜진 것으로 본다 (rules.get(..., True))
    assert cats({'homeroom': '1-3'}, '1-3(정)', rules={}) == ['담임']

    # 위반이 겹치면 전부 보고한다
    assert cats({'homeroom': '1-3', 'subject': '국어', 'isMain': False}, '1-3(정)') == ['교과', '권한', '담임']

    print('PASS: check_label 규칙 판정 검사 통과.')


def main():
    test_check_label()

    if not shutil.which('node'):
        print('SKIP: node 를 찾을 수 없어 JS 파서 대조를 건너뜁니다.')
        return 0

    labels = build_corpus()
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'labels.js'), encoding='utf-8') as f:
        js_results = run_js(f.read(), labels)

    failures = []
    for label, js in zip(labels, js_results):
        area, role = parse_label(label)
        py = [area, role, role_key(label), grade_of(area), ROLE_COL[role_key(label)]]
        if py != js:
            failures.append(f'  {label!r}\n    labels.py : {py}\n    labels.js : {js}')

    # 파서를 거치지 않는 최소 불변식도 함께 확인한다.
    for label in labels:
        area, _ = parse_label(label)
        assert label.startswith(area.split('(')[0]), f'구역명이 라벨 앞머리와 다름: {label}'
        assert role_key(label) in ROLE_COL, f'분류되지 않는 라벨: {label}'

    if failures:
        print(f'FAIL: 라벨 {len(failures)}건에서 labels.py 와 labels.js 결과가 다릅니다.\n')
        print('\n'.join(failures))
        return 1

    print(f'PASS: 라벨 {len(labels)}건 모두 labels.py / labels.js 파서 결과 일치.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
