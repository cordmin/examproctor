"""배정 라벨 해석과 규칙 판정.

labels.js 와 짝을 이루는 모듈이다. 규칙을 고칠 때는
반드시 양쪽을 함께 고쳐야 한다 (test_label_parity.py 가 대조한다).
"""
import re


# ── 배정 라벨 파서 ──────────────────────────────────────────────────────
# 라벨 형식: '1-3(정)' '1-3(부)' '1-3(수업)' '1학년(특수)' '1학년(특수)(부)'
#            '1학년(분리)' '1학년(복도)' '1학년(복도2)'
#
# ※ labels.js 의 parseLabel / roleKey / gradeOf 와 반드시 동일한 규칙을 유지할 것.
#   한쪽만 고치면 화면 표기와 엑셀 표기가 어긋난다.
_ROLE_ONLY = ('정', '부', '수업', '수')
_HALLWAY_RE = re.compile(r'^(\d+학년\(복도?)(\d*)\)$')

# 감독 유형 키 -> 통계 컬럼명
ROLE_COL = {'정': 'main', '부': 'sub', '복도': 'hall', '분리': 'sep', '수업': 'cls', '특수': 'sp'}

# check_label() 의 위반 분류 -> _generate_verify_data() 의 검사 항목 번호
CHECK_INDEX = {'권한': 2, '결시': 3, '담임': 4, '교과': 5}

def parse_label(label):
    """라벨을 (구역명, 역할표기) 로 분해한다. 복도는 구역 번호가 역할표기가 된다."""
    hw = _HALLWAY_RE.match(label)
    if hw:
        return f"{hw.group(1)})", hw.group(2)
    parts = label.split('(')
    if len(parts) <= 1:
        return label, ''
    
    last_token = parts[-1].replace(')', '')
    if last_token in _ROLE_ONLY:
        role = last_token
        area_parts = parts[:-1]
        area = area_parts[0]
        if len(area_parts) > 1:
            area += '(' + '('.join(area_parts[1:])
        return area, role
    else:
        first_token = parts[1].replace(')', '')
        if first_token in _ROLE_ONLY:
            return parts[0], first_token
        else:
            return label, ''

def role_key(label):
    """라벨을 감독 유형 하나로 분류한다. 검사 순서가 곧 우선순위다."""
    if '(수업)' in label: return '수업'
    if '(정)' in label:   return '정'
    if '(부)' in label:   return '부'
    if '복도' in label or '복' in label: return '복도'
    if '분리' in label:   return '분리'
    if '특수' in label:   return '특수'
    return '정'

def grade_of(text):
    """앞머리 숫자를 학년으로 뽑는다. 없으면 ''."""
    m = re.match(r'^(\d+)', text)
    return m.group(1) if m else ''

def period_num(name):
    """'3교시' -> 3. 숫자가 없으면 99(정렬 시 맨 뒤)."""
    m = re.search(r'\d+', name)
    return int(m.group()) if m else 99


def check_label(t, p_id, label, classSubjects, rules):
    """한 교사가 특정 교시에 이 라벨을 받아도 되는지 검사한다.

    반환: [(분류, 사유), ...]. 빈 리스트면 문제 없음.
    분류는 '권한 / 결시 / 담임 / 교과' 네 가지.

    사후 검증(_generate_verify_data)과 수동 교체 검사가 이 함수 하나를 공유한다.
    ※ 배정 알고리즘의 violates_absolute() 와는 일부러 합치지 않는다.
      이 함수는 배정 결과를 독립적으로 재검증하는 쪽이라,
      알고리즘과 같은 코드를 쓰면 알고리즘 버그를 잡아낼 수 없다.
    """
    area = parse_label(label)[0]
    grade = grade_of(area)
    out = []

    if '(정)' in label and not t.get('isMain'):      out.append(('권한', '정감독 권한 없음'))
    if '(부)' in label and not t.get('isSub'):       out.append(('권한', '부감독 권한 없음'))
    if '수업' in label and t.get(f'isClass{grade}') is False:
        out.append(('권한', f'{grade}학년 수업감독 권한 없음'))
    if ('복도' in label or '복' in label) and not t.get('isHallway'):   out.append(('권한', '복도감독 권한 없음'))
    if '분리' in label and not t.get('isSeparated'): out.append(('권한', '분리실 권한 없음'))
    if '특수' in label and not t.get('isSpecial'):   out.append(('권한', '특수학급 권한 없음'))

    abs_data = t.get('absences', {}).get(p_id)
    if abs_data:
        a_type, a_tgt = abs_data.get('type'), str(abs_data.get('target'))
        if a_type == 'ALL' or (a_type == 'GRADE' and a_tgt == grade) or (a_type == 'CLASS' and a_tgt == area):
            abs_str = '전체 결시' if a_type == 'ALL' else (f'{a_tgt}학년 결시' if a_type == 'GRADE' else f'{a_tgt} 결시')
            out.append(('결시', f"{abs_str} 시간대 '{area}' 배정 위반"))

    if rules.get('excludeHomeroom', True) and t.get('homeroom') == area:
        out.append(('담임', f"본인 담임학급({area}) 배정 위반"))

    if grade and rules.get('excludeSubject', True):
        subj = classSubjects.get(p_id, {}).get(grade, '')
        if subj and t.get('subject') == subj:
            out.append(('교과', f"본인 담당교과({subj}) 배정 위반"))

    return out
