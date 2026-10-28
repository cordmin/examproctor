// 배정 라벨 해석.
// 
// main.py 의 labels.py 와 짝을 이룬다. 규칙을 고칠 때는 반드시 양쪽을
// 함께 고쳐야 한다 — test_label_parity.py 가 두 구현을 대조한다.

const ROLE_ONLY = ['정', '부', '수업', '수'];
const HALLWAY_RE = /^(\d+학년\(복도?)(\d*)\)$/;

// 감독 유형 키 -> 통계 컬럼명
const ROLE_COL = { '정': 'main', '부': 'sub', '복도': 'hall', '분리': 'sep', '수업': 'cls', '특수': 'sp' };

function parseLabel(label) {
    const hw = label.match(HALLWAY_RE);
    if (hw) return { area: `${hw[1]})`, role: hw[2] };
    const parts = label.split('(');
    if (parts.length <= 1) return { area: label, role: '' };
    
    const lastToken = parts[parts.length - 1].replace(')', '');
    if (ROLE_ONLY.includes(lastToken)) {
        const areaParts = parts.slice(0, -1);
        let area = areaParts[0];
        if (areaParts.length > 1) {
            area += '(' + areaParts.slice(1).join('(');
        }
        return { area: area, role: lastToken };
    } else {
        const firstToken = parts[1].replace(')', '');
        if (ROLE_ONLY.includes(firstToken)) {
            return { area: parts[0], role: firstToken };
        } else {
            return { area: label, role: '' };
        }
    }
}

function roleKey(label) {
    if (label.includes('(수업)')) return '수업';
    if (label.includes('(정)'))   return '정';
    if (label.includes('(부)'))   return '부';
    if (label.includes('복도') || label.includes('복'))   return '복도';
    if (label.includes('분리'))   return '분리';
    if (label.includes('특수'))   return '특수';
    return '정';
}

function gradeOf(text) {
    const m = text.match(/^(\d+)/);
    return m ? m[1] : '';
}
