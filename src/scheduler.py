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

from labels import period_num, role_key
from validator import summarize

TRIES = 30   # 데이터 60명 x 12교시 기준 1회 약 0.05초


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

                    for k, r, ik in [('special', '특수', 'special'), ('separated', '분리', 'separated')]:
                        cnt = config.get(k, {}).get(g_str, 0)
                        inv = int(invigCounts.get(g_str, {}).get(ik, 1))
                        for i in range(1, cnt + 1):
                            nm = f"{grade}학년({r})" if cnt == 1 else f"{grade}학년({r}{i})"
                            slots.append({"name": nm, "type": k, "role": r, "subject": "", "grade": g_str})
                            if inv >= 2:
                                slots.append({"name": nm, "type": k, "role": f"{r}(부)", "subject": "", "grade": g_str})

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
                "reasons": [{"message": "현재 설정에서 감독이 필요한 시간이 없습니다.", "action": "기초 설정에서 시험 학년을 켜고, 학년별 교시에 시험 과목 또는 자습을 선택하세요.", "target": "tab-config"}]}}
        if total_capacity < total_required_slots:
            return {"success": False, "error_type": "CAPACITY",
                    "validation": {"shortage": True, "required": total_required_slots, "available": total_capacity, "logs": [], "stats": []},
                    "failure": {"summary": f"필요한 감독 횟수는 {total_required_slots}회이며, 현재 가능한 횟수는 {total_capacity}회로 {total_required_slots - total_capacity}회 부족합니다.",
                                "reasons": [
                                    {"message": "감독 가능한 총 횟수가 부족합니다.", "action": "감독 명단에서 누락된 교사를 추가하세요. 결시 관리의 배정 제한(시간)이 실제보다 낮게 입력되어 있다면 수정하세요.", "target": "tab-teachers"},
                                    {"message": "결시와 배정 인원 설정도 가용 횟수에 영향을 줍니다.", "action": "결시 관리에서 잘못 표시한 결시가 없는지 확인하고, 기초 설정의 학급·고사실 수와 교실별 배정 인원이 실제 계획과 일치하는지 확인하세요.", "target": "tab-config"}]}}

        def is_absent(t_abs, p_id, g, c):
            if p_id not in t_abs:
                return False
            av = t_abs[p_id]
            return (av.get('type') == 'ALL'
                    or (av.get('type') == 'GRADE' and str(av.get('target')) == str(g))
                    or (av.get('type') == 'CLASS' and str(av.get('target')) == str(c)))

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

        def violates_absolute(t, state, p_id, date, p_num, s_nm, s_rl, s_gd, assigned_this_period):
            if t['id'] in assigned_this_period:
                return "동시간 중복 배정"
            if state['assigned_total'] >= max_of(t):
                return "배정 제한 시간 도달"
            if rules.get('excludeHomeroom', True) and t.get('homeroom') == s_nm:
                return "본인 담임학급 배정 금지"

            exam_subj = classSubjects.get(p_id, {}).get(str(s_gd), "")
            if rules.get('excludeSubject', True) and exam_subj and t.get('subject') == exam_subj:
                return "본인 담당교과 배정 금지"

            if state['history']:
                last = state['history'][-1]
                if last['date'] == date and last['p_num'] == p_num - 1:
                    if rules.get('excludeSameClass', True) and last['class_name'] == s_nm:
                        return "동일 학급 연속 배정 금지"
                    if rules.get('excludeClassConsecutive', True) and "수업" in s_rl and "수업" in last['role']:
                        return "자습감독 연속 배정 금지"
                    if rules.get('excludeHallwayConsecutive', True) and "복도" in s_rl and "복도" in last['role']:
                        return "복도감독 연속 배정 금지"
            return False

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
                            "감독 유형 권한 없음": (f"감독 명단에서 {s_gd}학년 {('자습' if s_rl == '수업' else s_rl)} 감독이 가능한 교사의 해당 체크를 켜세요.", "tab-teachers"),
                            "해당 시간 결시": ("결시 관리에서 해당 교시의 전체·학년·학급 결시를 확인하고 잘못 입력한 결시를 수정하세요.", "tab-absences"),
                            "동시간 중복 배정": ("같은 교시에 한 교사가 두 곳을 감독할 수 없습니다. 감독 가능한 교사를 추가하거나 기초 설정의 교실별 배정 인원이 실제 계획보다 많지 않은지 확인하세요.", "tab-config"),
                            "배정 제한 시간 도달": ("결시 관리에서 해당 교사의 배정 제한(시간)을 확인하고, 가능한 범위에서 늘리거나 감독 인원을 추가하세요.", "tab-absences"),
                            "본인 담임학급 배정 금지": ("다른 학급을 맡을 수 있는 감독 인원을 확보하세요. 학교 운영상 허용하는 경우에만 배정 규칙에서 담임학급 시간 배정 금지를 해제하세요.", "rules"),
                            "본인 담당교과 배정 금지": ("해당 과목을 담당하지 않는 감독 인원을 확보하세요. 학교 운영상 허용하는 경우에만 배정 규칙에서 담당교과 시간 배정 금지를 해제하세요.", "rules"),
                            "동일 학급 연속 배정 금지": ("해당 시간에 다른 교사를 배정할 수 있도록 인원을 확보하거나, 허용하는 경우 배정 규칙에서 동일 학급 연속 배정 금지를 해제하세요.", "rules"),
                            "자습감독 연속 배정 금지": ("학년별 자습 감독이 가능한 교사를 더 확보하거나, 허용하는 경우 배정 규칙에서 수업감독(자습) 연속 배정 금지를 해제하세요.", "rules"),
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
                        raise AssignmentFailure(f"{date} {p['name']} · {s_nm} {('자습감독' if s_rl == '수업' else s_rl + '감독')}: 현재 설정으로 배정 가능한 조합을 찾지 못했습니다.", reasons)

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
