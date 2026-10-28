"""감독 배정 알고리즘.

교시별로 슬롯을 만들고, 슬롯마다 절대 규칙 -> 형평성 규칙 순으로 후보를 거른 뒤
피로도/횟수 균형 점수가 가장 낮은 교사를 배정한다. 후보가 없으면 형평성 규칙만
단계적으로 완화한다(절대 규칙은 완화하지 않는다).

한 번의 배정은 앞에서 고른 교사 때문에 뒤 슬롯이 막힐 수 있는 순차(욕심쟁이) 방식이다.
그래서 슬롯 순서·동점 처리를 무작위로 바꿔 TRIES 번 돌리고,
완화 횟수가 가장 적고 부담이 가장 고른 결과를 고른다.
"""
import random
import statistics
import traceback

from labels import absence_targets, period_num, role_key
from validator import summarize

TRIES = 30   # 데이터 60명 x 12교시 기준 1회 약 0.05초

# 배정이 막혔을 때 먼저 풀어 보라고 권하는 순서 (학교 운영에 부담이 적은 것부터).
# 연속 감독 횟수 제한과 1일 편차는 배정 중에 이미 자동으로 완화하므로 여기 없다.
RELAX_ORDER = ["수업감독 연속 배정 금지", "복도감독 연속 배정 금지", "동일 학급 연속 배정 금지",
               "본인 담당교과 배정 금지", "본인 담임학급 배정 금지", "배정 제한 시간 도달"]


class AssignmentFailure(Exception):
    def __init__(self, summary, reasons):
        super().__init__(summary)
        self.failure = {"summary": summary, "reasons": reasons}


def run_algorithm(appData):
    try:
        config = appData.get('config', {})
        rules, invigCounts = config.get('rules', {}), config.get('invigCounts', {})
        teachers, periods, classSubjects = appData.get('teachers', []), appData.get('periods', []), appData.get('classSubjects', {})

        f_main, f_sub, f_class, f_hall, f_sep, f_sp = [int(rules.get(k, v)) for k, v in [('fatigueMain', 5), ('fatigueSub', 3), ('fatigueClass', 1), ('fatigueHall', 2), ('fatigueSep', 4), ('fatigueSp', 4)]]
        bal_strategy = rules.get('balanceStrategy', 'FATIGUE')

        def new_states():
            return {
                t['id']: {
                    "t": t,
                    "assigned_total": 0,
                    "assigned_daily": {},
                    "role_counts": {"정": 0, "부": 0, "복도": 0, "분리": 0, "특수": 0, "수업": 0},
                    "history": []
                } for t in teachers
            }

        def compute_workload(rc):
            return rc['정']*f_main + rc['특수']*f_sp + rc['분리']*f_sep + rc['부']*f_sub + rc['복도']*f_hall + rc['수업']*f_class

        periods_sorted = sorted(periods, key=lambda x: (x['date'], period_num(x['name'])))
        if not periods_sorted:
            return {"success": False, "error_type": "INPUT", "failure": {
                "summary": "시험 일정과 교시가 설정되지 않았습니다.",
                "reasons": [{"message": "배정할 시험 시간이 없습니다.", "action": "기초 설정에서 시험 날짜와 교시를 추가한 뒤 다시 실행하세요.", "target": "tab-config"}]}}


        def count_all_absent(t):
            return sum(1 for p in periods_sorted
                       if t.get('absences', {}).get(p['id'], {}).get('type') == 'ALL')

        # 0 나눗셈 방지를 위해 최소 1로 둔다 (배정 비율 계산의 분모)
        avail_map = {t['id']: max(1, len(periods_sorted) - count_all_absent(t)) for t in teachers}
        slots_by_period = {}
        total_required_slots = 0

        for p in periods_sorted:
            p_id, slots = p['id'], []
            for grade in config.get('grades', []):
                g_str = str(grade)
                subj = classSubjects.get(p_id, {}).get(g_str, "")
                if subj:
                    c_count = config.get('classes', {}).get(g_str, 0)
                    c_invig = int(invigCounts.get(g_str, {}).get('class', 2))
                    for c in range(1, c_count + 1):
                        if subj == '자습':
                            slots.append({"name": f"{grade}-{c}", "type": "class", "role": "수업", "subject": subj, "grade": g_str})
                        else:
                            slots.append({"name": f"{grade}-{c}", "type": "class", "role": "정", "subject": subj, "grade": g_str})
                            if c_invig >= 2:
                                slots.append({"name": f"{grade}-{c}", "type": "class", "role": "부", "subject": subj, "grade": g_str})

                    for k, r in [('special', '특수'), ('separated', '분리')]:
                        cnt = config.get(k, {}).get(g_str, 0)
                        for i in range(1, cnt + 1):
                            nm = f"{grade}학년({r})" if cnt == 1 else f"{grade}학년({r}{i})"
                            slots.append({"name": nm, "type": k, "role": r, "subject": "", "grade": g_str})

                    if subj != '자습':
                        hw_count = config.get('hallways', {}).get(g_str, 0)
                        for hw in range(1, hw_count + 1):
                            hw_nm = f"{grade}학년(복)" if hw_count == 1 else f"{grade}학년(복{hw})"
                            slots.append({"name": hw_nm, "type": "hallway", "role": "복도", "subject": "", "grade": g_str})

            slots_by_period[p_id] = slots
            total_required_slots += len(slots)

        active_teachers = [t for t in teachers if not t.get('isAbsentAll', False)]

        def max_of(t):
            return int(t.get('maxPeriods') or 0) or 999

        # 1일 편차 비교에서 그날 종일 결시한 교사는 뺀다. (0회가 기준이 되면 규칙이 늘 완화된다)
        day_pids = {}
        for p in periods_sorted:
            day_pids.setdefault(p['date'], []).append(p['id'])
        works_on = {(t['id'], d): any(t.get('absences', {}).get(pid, {}).get('type') != 'ALL' for pid in pids)
                    for t in active_teachers for d, pids in day_pids.items()}

        def calc_teacher_capacity(t):
            available = len(periods_sorted) - count_all_absent(t)
            max_p = int(t.get('maxPeriods') or 0)
            if max_p > 0:
                return max(0, min(max_p, available))
            return max(0, available)

        total_capacity = sum(calc_teacher_capacity(t) for t in active_teachers)

        if not total_required_slots:
            return {"success": False, "error_type": "INPUT", "failure": {
                "summary": "배정할 학년과 과목이 선택되지 않았습니다.",
                "reasons": [{"message": "현재 설정에서 감독이 필요한 시간이 없습니다.", "action": "기초 설정에서 시험 학년을 켜고, 학년별 교시에 시험 과목 또는 수업을 선택하세요.", "target": "tab-config"}]}}

        # 인원 부족은 '선생님이 몇 명 더 있어야 하는지'로 알려 준다.
        # 한 교시에 한 선생님은 한 자리만 맡으므로 (1) 교시마다 자리 수 > 그 교시에 감독할 수 있는 선생님 수,
        # (2) 전체 자리 수 > 선생님들이 맡을 수 있는 시간의 합 이면 어떤 순서로도 배정할 수 없다.
        n_periods = len(periods_sorted)
        free_at = {p['id']: sum(1 for t in active_teachers
                                if t.get('absences', {}).get(p['id'], {}).get('type') != 'ALL')
                   for p in periods_sorted}

        def need_for(capacity, skip=lambda s: False):
            """(가장 모자란 교시, 그 교시 부족 인원, 필요한 선생님 수). skip 한 자리는 없는 셈 친다."""
            gaps = {p['id']: sum(1 for s in slots_by_period[p['id']] if not skip(s)) - free_at[p['id']] for p in periods_sorted}
            worst = max(periods_sorted, key=lambda p: gaps[p['id']])
            total_gap = sum(1 for p in periods_sorted for s in slots_by_period[p['id']] if not skip(s)) - capacity
            # 새 선생님 한 명은 교시마다 한 자리씩 맡을 수 있다
            return worst, gaps[worst['id']], max(gaps[worst['id']], -(-total_gap // n_periods))

        def when(p):
            _, m, d = p['date'].split('-')
            return f"{int(m)}월 {int(d)}일 {p['name']}"

        def capacity_reasons(need, worst, worst_gap):
            """부족할 때 '먼저 해 볼 것'을 순서대로: 배정 제한 → 교실별 배정 인원 → 결시 확인 → 선생님 추가."""
            reasons = []
            if worst_gap > 0:
                reasons.append({"message": f"{when(worst)}에는 감독 자리가 {len(slots_by_period[worst['id']])}곳인데, 감독할 수 있는 선생님은 {free_at[worst['id']]}명뿐입니다.",
                                "action": "한 선생님은 한 교시에 한 자리만 맡을 수 있습니다. 이 시간에 잘못 넣은 결시가 없는지 확인하세요.", "target": "tab-absences"})

            limited = sorted(((t, max(0, n_periods - count_all_absent(t)) - calc_teacher_capacity(t)) for t in active_teachers),
                             key=lambda x: -x[1])
            limited = [(t, gain) for t, gain in limited if gain > 0]
            after = need_for(total_capacity + sum(g for _, g in limited))[2] if limited else need
            if after < need:   # 풀어도 소용없으면 안내하지 않는다
                names = ', '.join(f"{t['name']}({t['maxPeriods']}시간)" for t, _ in limited[:5]) + (f" 외 {len(limited) - 5}명" if len(limited) > 5 else '')
                effect = "이 제한만 풀어도 해결됩니다." if after <= 0 else f"모두 풀면 필요한 선생님이 {need - after}명 줄어듭니다."
                reasons.append({"message": f"배정 제한이 걸린 선생님: {names}",
                                "action": f"{effect} 결시 관리에서 배정 제한을 늘릴 수 있는지 확인하세요.", "target": "tab-absences"})

            for g in config.get('grades', []):
                g_str = str(g)
                for role, place in [('부', '교실'), ('특수(부)', '특수 고사실'), ('분리(부)', '분리 고사실')]:
                    if not any(s['grade'] == g_str and s['role'] == role for p in periods_sorted for s in slots_by_period[p['id']]):
                        continue
                    after = need_for(total_capacity, lambda s: s['grade'] == g_str and s['role'] == role)[2]
                    if after >= need:
                        continue
                    effect = "이것만으로 해결됩니다." if after <= 0 else f"필요한 선생님이 {need - after}명 줄어듭니다."
                    reasons.append({"message": f"{g}학년 {place} 감독을 2명에서 1명으로 줄이면 {effect}",
                                    "action": "기초 설정의 교실별 배정 인원에서 정·부감독(2인)을 정감독(1인)으로 바꿀 수 있습니다.", "target": "tab-config"})

            absent = sorted(((t, count_all_absent(t)) for t in active_teachers), key=lambda x: -x[1])
            absent = [f"{t['name']}({n}시간)" for t, n in absent if n] + [f"{t['name']}(전체 제외)" for t in teachers if t.get('isAbsentAll')]
            if absent:
                reasons.append({"message": f"결시로 감독에서 빠진 선생님: {', '.join(absent[:5])}" + (f" 외 {len(absent) - 5}명" if len(absent) > 5 else ''),
                                "action": "결시가 실제 계획과 맞는지 확인하세요. 잘못 넣은 결시를 지우면 그만큼 감독할 수 있습니다.", "target": "tab-absences"})

            reasons.append({"message": f"가장 확실한 방법은 감독 선생님을 {need}명 이상 추가하는 것입니다.",
                            "action": "감독 명단에 빠진 선생님이 없는지 확인하고 추가하세요.", "target": "tab-teachers"})
            return reasons

        worst, worst_gap, need = need_for(total_capacity)
        if need > 0:
            reasons = capacity_reasons(need, worst, worst_gap)
            summary = f"감독 선생님이 최소 {need}명 더 있어야 지금 조건으로 감독 시간표를 짤 수 있습니다."
            return {"success": False, "error_type": "CAPACITY",
                    "validation": {"shortage": True, "need": need, "summary": summary, "reasons": reasons,
                                   "required": total_required_slots, "available": total_capacity, "logs": [], "stats": []},
                    "failure": {"summary": summary, "reasons": reasons}}

        def is_absent(t_abs, p_id, g, c):
            if p_id not in t_abs:
                return False
            av = t_abs[p_id]
            targets = absence_targets(av)
            return (av.get('type') == 'ALL'
                    or (av.get('type') == 'GRADE' and str(g) in targets)
                    or (av.get('type') == 'CLASS' and str(c) in targets))

        def has_role_permission(t, s_rl, s_gd):
            if "수업" in s_rl:
                if s_gd == '1' and t.get('isClass1') is False: return False
                if s_gd == '2' and t.get('isClass2') is False: return False
                if s_gd == '3' and t.get('isClass3') is False: return False
            elif "정" in s_rl and not t.get('isMain'):       return False
            elif "부" in s_rl and not t.get('isSub'):        return False
            elif "복도" in s_rl and not t.get('isHallway'):  return False
            elif "분리" in s_rl and not t.get('isSeparated'): return False
            elif "특수" in s_rl and not t.get('isSpecial'):  return False
            return True

        def absolute_blocks(t, state, p_id, date, p_num, s_nm, s_rl, s_gd, assigned_this_period):
            """이 교사를 이 자리에 못 넣는 절대 규칙을 모두 차례로 내놓는다."""
            if t['id'] in assigned_this_period:
                yield "동시간 중복 배정"
            if state['assigned_total'] >= max_of(t):
                yield "배정 제한 시간 도달"
            if rules.get('excludeHomeroom', True) and t.get('homeroom') == s_nm:
                yield "본인 담임학급 배정 금지"

            exam_subj = classSubjects.get(p_id, {}).get(str(s_gd), "")
            if rules.get('excludeSubject', True) and exam_subj and t.get('subject') == exam_subj:
                yield "본인 담당교과 배정 금지"

            if state['history']:
                last = state['history'][-1]
                if last['date'] == date and last['p_num'] == p_num - 1:
                    if rules.get('excludeSameClass', True) and last['class_name'] == s_nm:
                        yield "동일 학급 연속 배정 금지"
                    if rules.get('excludeClassConsecutive', True) and "수업" in s_rl and "수업" in last['role']:
                        yield "수업감독 연속 배정 금지"
                    if rules.get('excludeHallwayConsecutive', True) and "복도" in s_rl and "복도" in last['role']:
                        yield "복도감독 연속 배정 금지"

        def violates_absolute(*args):
            return next(absolute_blocks(*args), False)

        def violates_fairness(state, date, p_num, relax_level, min_daily):
            if relax_level < 2 and int(rules.get('maxConsecutive', 99)) < 99:
                max_c = int(rules['maxConsecutive'])
                recent = sum(1 for h in state['history'] if h['date'] == date and h['p_num'] >= p_num - max_c)
                if recent >= max_c:
                    return True
            if relax_level < 1 and int(rules.get('maxDailyDiff', 99)) < 99:
                if state['assigned_daily'].get(date, 0) + 1 - min_daily > int(rules['maxDailyDiff']):
                    return True
            return False

        def score_for_sort(state, date, slot_role=''):
            avail = avail_map[state['t']['id']]
            rc    = state['role_counts']
            daily = state['assigned_daily'].get(date, 0)

            if '정' in slot_role:
                role_rate = rc['정'] / avail
            elif '부' in slot_role:
                role_rate = rc['부'] / avail
            elif '수업' in slot_role:
                role_rate = rc['수업'] / avail
            elif '복도' in slot_role:
                role_rate = rc['복도'] / avail
            elif '분리' in slot_role:
                role_rate = rc['분리'] / avail
            elif '특수' in slot_role:
                role_rate = rc['특수'] / avail
            else:
                role_rate = state['assigned_total'] / avail

            wl = compute_workload(rc)
            wl_rate = wl / avail

            if bal_strategy == 'FATIGUE':
                base = role_rate * 100000 + wl_rate * 1000 + daily * 10
            else:
                cnt_rate = state['assigned_total'] / avail
                base = role_rate * 100000 + cnt_rate * 1000 + daily * 10

            return base + random.random() * 0.001

        def attempt():
            t_states = new_states()
            assignments, validation_logs = {t['id']: {} for t in teachers}, []
            for p in periods_sorted:
                p_id  = p['id']
                date  = p['date']
                p_num = period_num(p['name'])

                def slot_priority(s):
                    r = s['role']
                    if '정' in r:   return 0
                    if '특수' in r: return 1
                    if '분리' in r: return 2
                    if '부' in r:   return 3
                    if '복도' in r: return 4
                    return 5

                priority_grouped = {}
                for s in slots_by_period[p_id]:
                    priority_grouped.setdefault(slot_priority(s), []).append(s)
                slots_ordered = []
                for pri in sorted(priority_grouped.keys()):
                    group = priority_grouped[pri]
                    random.shuffle(group)
                    slots_ordered.extend(group)

                assigned_this_period = set()

                for slot in slots_ordered:
                    s_nm = slot['name']
                    s_sj = slot['subject']
                    s_rl = slot['role']
                    s_gd = slot.get('grade', '')
                    best_teacher = None

                    min_daily = min((t_states[t['id']]['assigned_daily'].get(date, 0)
                                     for t in active_teachers if works_on[t['id'], date]), default=0)

                    for relax in range(3):
                        candidates = []
                        for t in active_teachers:
                            state = t_states[t['id']]
                            if not has_role_permission(t, s_rl, s_gd):
                                continue
                            if is_absent(t.get('absences', {}), p_id, s_gd, s_nm):
                                continue
                            if violates_absolute(t, state, p_id, date, p_num, s_nm, s_rl, s_gd, assigned_this_period):
                                continue
                            if violates_fairness(state, date, p_num, relax, min_daily):
                                continue
                            candidates.append(state)

                        if candidates:
                            candidates.sort(key=lambda x: score_for_sort(x, date, s_rl))
                            best_teacher = candidates[0]
                            if relax > 0:
                                validation_logs.append(
                                    f"⚠️ [{date} {p['name']}] '{s_nm}' 배정 : "
                                    f"인력 부족으로 [{best_teacher['t']['name']}] 교사의 "
                                    f"형평성 규칙을 완화(단계{relax})하여 배정했습니다."
                                )
                            break

                    if not best_teacher:
                        remedies = {
                            "전체 배정 제외": ("감독 명단과 결시 설정에서 배정 제외 상태가 실제 계획과 일치하는지 확인하세요.", "tab-teachers"),
                            "감독 유형 권한 없음": (f"감독 명단에서 {s_gd}학년 {s_rl} 감독이 가능한 교사의 해당 체크를 켜세요.", "tab-teachers"),
                            "해당 시간 결시": ("결시 관리에서 해당 교시의 전체·학년·학급 결시를 확인하고 잘못 입력한 결시를 수정하세요.", "tab-absences"),
                            "동시간 중복 배정": ("같은 교시에 한 교사가 두 곳을 감독할 수 없습니다. 감독 가능한 교사를 추가하거나 기초 설정의 교실별 배정 인원이 실제 계획보다 많지 않은지 확인하세요.", "tab-config"),
                            "배정 제한 시간 도달": ("결시 관리에서 해당 교사의 배정 제한을 확인하고, 가능한 범위에서 늘리거나 감독 인원을 추가하세요.", "tab-absences"),
                            "본인 담임학급 배정 금지": ("다른 학급을 맡을 수 있는 감독 인원을 확보하세요. 학교 운영상 허용하는 경우에만 배정 규칙에서 담임학급 시간 배정 금지를 해제하세요.", "rules"),
                            "본인 담당교과 배정 금지": ("해당 과목을 담당하지 않는 감독 인원을 확보하세요. 학교 운영상 허용하는 경우에만 배정 규칙에서 담당교과 시간 배정 금지를 해제하세요.", "rules"),
                            "동일 학급 연속 배정 금지": ("해당 시간에 다른 교사를 배정할 수 있도록 인원을 확보하거나, 허용하는 경우 배정 규칙에서 동일 학급 연속 배정 금지를 해제하세요.", "rules"),
                            "수업감독 연속 배정 금지": ("학년별 수업 감독이 가능한 교사를 더 확보하거나, 허용하는 경우 배정 규칙에서 수업감독 연속 배정 금지를 해제하세요.", "rules"),
                            "복도감독 연속 배정 금지": ("복도감독이 가능한 교사를 더 확보하거나, 허용하는 경우 배정 규칙에서 복도감독 연속 배정 금지를 해제하세요.", "rules"),
                        }
                        counts = {}
                        for t in teachers:
                            if t.get('isAbsentAll', False): reason = "전체 배정 제외"
                            elif not has_role_permission(t, s_rl, s_gd): reason = "감독 유형 권한 없음"
                            elif is_absent(t.get('absences', {}), p_id, s_gd, s_nm): reason = "해당 시간 결시"
                            else: reason = violates_absolute(t, t_states[t['id']], p_id, date, p_num, s_nm, s_rl, s_gd, assigned_this_period)
                            if reason: counts[reason] = counts.get(reason, 0) + 1
                        reasons = [{"message": f"{reason}: {count}명", "action": remedies[reason][0], "target": remedies[reason][1]}
                                   for reason, count in counts.items()]
                        # 규칙을 하나만 풀었을 때 이 자리에 들어갈 수 있게 되는 교사 수를 세어,
                        # 학교 운영에 부담이 적은 규칙부터 '먼저 풀어 볼 규칙'으로 앞에 보여 준다.
                        unlock = {}
                        for t in active_teachers:
                            if not has_role_permission(t, s_rl, s_gd) or is_absent(t.get('absences', {}), p_id, s_gd, s_nm):
                                continue
                            blocks = set(absolute_blocks(t, t_states[t['id']], p_id, date, p_num, s_nm, s_rl, s_gd, assigned_this_period))
                            if len(blocks) == 1:
                                rule = blocks.pop()
                                unlock[rule] = unlock.get(rule, 0) + 1
                        tips = [{"message": f"{i}순위로 풀어 볼 규칙: {rule} (풀면 이 자리에 {unlock[rule]}명 배정 가능)",
                                 "action": remedies[rule][0], "target": remedies[rule][1]}
                                for i, rule in enumerate((r for r in RELAX_ORDER if unlock.get(r)), 1)]
                        tipped = {r for r in RELAX_ORDER if unlock.get(r)}
                        reasons = tips + [r for r, reason in zip(reasons, counts) if reason not in tipped]
                        raise AssignmentFailure(f"{when(p)} {s_nm} {s_rl}감독 자리에 들어갈 수 있는 선생님이 없습니다.", reasons)

                    bt_id = best_teacher['t']['id']
                    best_teacher['assigned_total'] += 1
                    best_teacher['assigned_daily'][date] = best_teacher['assigned_daily'].get(date, 0) + 1
                    assigned_this_period.add(bt_id)
                    best_teacher['history'].append({
                        'date': date, 'p_num': p_num, 'role': s_rl, 'class_name': s_nm
                    })

                    if s_sj == '자습' or best_teacher['t'].get('subject') == s_sj:
                        label = f"{s_nm}(수업)"
                    elif slot['type'] == 'class':
                        label = f"{s_nm}({s_rl})"
                    else:
                        label = s_nm if "(부)" not in s_rl else f"{s_nm}(부)"

                    # 역할 집계는 슬롯이 아니라 최종 라벨 기준으로 센다.
                    # revalidate / export_excel / 화면 집계가 모두 라벨을 보므로,
                    # 여기서만 슬롯을 보면 자동배정 직후와 재검증 후 숫자가 달라진다.
                    best_teacher['role_counts'][role_key(label)] += 1
                    assignments[bt_id][p_id] = label

            return assignments, validation_logs, t_states

        def quality(result):
            """작을수록 좋다: (완화 횟수, 주 기준 편차, 보조 기준 편차). 결시를 반영한 비율로 비교한다."""
            _, logs, t_states = result
            wl = [compute_workload(t_states[t['id']]['role_counts']) / avail_map[t['id']] for t in active_teachers]
            cnt = [t_states[t['id']]['assigned_total'] / avail_map[t['id']] for t in active_teachers]
            spread = lambda xs: statistics.pstdev(xs) if xs else 0
            main, sub = (wl, cnt) if bal_strategy == 'FATIGUE' else (cnt, wl)
            return (len(logs), spread(main), spread(sub))

        best, last_error = None, None
        for _ in range(TRIES):
            try:
                result = attempt()
            except Exception as e:   # 이번 순서로는 막혔다. 다른 순서로 다시 시도한다.
                last_error = e
                continue
            if best is None or quality(result) < quality(best):
                best = result
        if best is None:
            raise last_error
        assignments, validation_logs, _ = best

        validation = summarize(teachers, periods, assignments,
                               classSubjects, rules, validation_logs)
        return {"success": True, "assignments": assignments, "validation": validation}
    except AssignmentFailure as e:
        return {"success": False, "error_type": "CONSTRAINT", "error": str(e), "failure": e.failure}
    except Exception as e:
        print(traceback.format_exc())
        return {"success": False, "error_type": "UNKNOWN", "error": str(e)}
