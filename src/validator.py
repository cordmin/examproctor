"""배정 결과 사후 검증과 통계 집계.

검증은 배정 알고리즘(scheduler)과 일부러 따로 구현되어 있다.
같은 코드를 쓰면 알고리즘 버그를 잡아낼 수 없기 때문이다.
"""
import statistics

from labels import CHECK_INDEX, ROLE_COL, check_label, parse_label, period_num, role_key


def generate_verify_data(teachers, periods, assignments, classSubjects, rules):
    checks = [
        {"name": "1. 모든 구역/학급 배정 완료", "desc": "요구된 모든 시험감독 자리에 누락 없이 교사가 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "2. 동일 교시 중복 배정 방지", "desc": "한 교시 동안 2개 이상의 감독 자리에 중복 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "3. 교사별 감독 역할 권한 일치", "desc": "교사별로 허용된 감독 역할(정, 부, 복, 자 등)에 맞게 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "4. 결시 교사 배정 방지", "desc": "전체/학년/학급 결시로 설정된 시간대에 배정된 교사가 없는지 확인합니다.", "pass": True, "messages": []},
        {"name": "5. 본인 담임학급 배정 금지", "desc": "본인이 담임을 맡고 있는 학급의 시험 감독으로 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "6. 본인 담당교과 배정 금지", "desc": "본인이 담당하는 교과목의 시험 시간대에 감독으로 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "7. 동일 학급 연속 배정 금지", "desc": "동일한 학급에 연속으로 시험 감독이 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "8. 동일 역할(수업/복도) 연속 배정 금지", "desc": "수업감독 또는 복도감독이 2연속으로 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "9. 1일 최대 연속 감독 횟수 제한", "desc": "하루 최대 연속 감독 시간 제한을 초과하여 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "10. 교사별 배정 제한 준수", "desc": "교사별 설정된 '배정 제한' 한도를 초과하여 배정되었는지 확인합니다.", "pass": True, "messages": []},
        {"name": "11. 1일 감독 횟수 편차 제한", "desc": "1일 최대 감독 횟수 편차 한도를 초과하여 교사 간 불균형이 있는지 확인합니다.", "pass": True, "messages": []}
    ]

    # 실패한 검사 카드에 보여 줄 해결 방법과 바로 가기 화면 (검사 순서와 같다).
    swap = "배정 결과에서 해당 칸을 다른 선생님과 교체하세요."
    rule_off = (swap + " 학교에서 허용한다면 배정 규칙에서 이 규칙을 해제할 수 있습니다.", "rules")
    fixes = [
        ("배정을 다시 실행하세요. 계속 비면 감독 명단에 선생님을 추가하세요.", "tab-teachers"),
        (swap, "tab-result"),
        ("감독 명단에서 해당 감독 권한을 켜거나, " + swap, "tab-teachers"),
        ("결시 관리에서 결시가 맞는지 확인하고, 맞다면 " + swap, "tab-absences"),
        rule_off, rule_off, rule_off, rule_off,
        ("연속으로 맡은 시간 중 하나를 다른 선생님과 교체하거나, 배정 규칙에서 연속 감독 시간을 늘리세요.", "rules"),
        ("결시 관리에서 배정 제한이 맞는지 확인하거나, " + swap, "tab-absences"),
        ("가장 많이 맡은 선생님의 감독 하나를 가장 적게 맡은 선생님과 교체하거나, 배정 규칙에서 편차 허용을 늘리세요.", "rules"),
    ]
    for c, (fix, target) in zip(checks, fixes):
        c['fix'], c['fix_target'] = fix, target

    periods_sorted = sorted(periods, key=lambda x: (x['date'], period_num(x['name'])))

    # targets[i] = [교사 id, 교시 id] — 검증 화면에서 메시지를 누르면 배정 결과의 그 칸으로 이동한다.
    for c in checks:
        c['targets'] = []

    def fail(idx, msg, t_id='', p_id=''):
        checks[idx]['pass'] = False
        checks[idx]['messages'].append(msg)
        checks[idx]['targets'].append([t_id, p_id])

    for t in teachers:
        t_id = t['id']
        t_assigns = assignments.get(t_id, {})

        actual_count = sum(1 for v in t_assigns.values() if v and v != '-')
        max_p = int(t.get('maxPeriods', 0) or 999)
        if max_p != 999 and actual_count > max_p:
            fail(9, f"[{t['name']}] 배정 제한 초과 (설정:{max_p}시간, 실제:{actual_count}시간)", t_id)

        history_full = []
        for p in periods_sorted:
            p_id = p['id']
            label = t_assigns.get(p_id)
            if label and label != '-':
                history_full.append({'date': p['date'], 'p_num': period_num(p['name']), 'label': label, 'pid': p_id})

        for p_id, label in t_assigns.items():
            if not label or label == '-': continue
            for category, msg in check_label(t, p_id, label, classSubjects, rules):
                fail(CHECK_INDEX[category], f"[{t['name']}] {msg}", t_id, p_id)

        for i in range(1, len(history_full)):
            prev, curr = history_full[i-1], history_full[i]
            if prev['date'] == curr['date'] and curr['p_num'] == prev['p_num'] + 1:
                prev_cn, curr_cn = parse_label(prev['label'])[0], parse_label(curr['label'])[0]
                if rules.get('excludeSameClass', True) and prev_cn == curr_cn:
                    fail(6, f"[{t['name']}] 동일 학급('{curr_cn}') 2연속 배정 위반", t_id, curr['pid'])
                if rules.get('excludeClassConsecutive', True) and '수업' in prev['label'] and '수업' in curr['label']:
                    fail(7, f"[{t['name']}] 수업감독 2연속 배정 위반", t_id, curr['pid'])
                if rules.get('excludeHallwayConsecutive', True) and '복도' in prev['label'] and '복도' in curr['label']:
                    fail(7, f"[{t['name']}] 복도감독 2연속 배정 위반", t_id, curr['pid'])

        max_consec = int(rules.get('maxConsecutive', 99))
        if max_consec < 99:
            history_by_date = {}
            for h in history_full: history_by_date.setdefault(h['date'], []).append(h)
            for date, hs in history_by_date.items():
                consec = 1
                for j in range(1, len(hs)):
                    if hs[j]['p_num'] == hs[j-1]['p_num'] + 1:
                        consec += 1
                        if consec > max_consec:
                            fail(8, f"[{t['name']}] {date} 연속 {consec}시간 배정 (제한:{max_consec}시간)", t_id, hs[j]['pid'])
                            break
                    else: consec = 1

    max_diff = int(rules.get('maxDailyDiff', 99))
    if max_diff < 99:
        daily_counts = {}
        active_teachers = [t for t in teachers if not t.get('isAbsentAll', False)]
        for t in active_teachers:
            t_id = t['id']
            for p_id, label in assignments.get(t_id, {}).items():
                if label and label != '-':
                    date = next((px['date'] for px in periods if px['id'] == p_id), "")
                    daily_counts.setdefault(date, {}).setdefault(t_id, 0)
                    daily_counts[date][t_id] += 1
        # 편차가 난 날은 누가 가장 많이/적게 했는지와 그 사정(결시, 전담 등)을 함께 적는다.
        def reason(t, date):
            day = [p for p in periods_sorted if p['date'] == date]
            off = [p['name'] for p in day if t.get('absences', {}).get(p['id'], {}).get('type') == 'ALL']
            if off:
                return '종일 결시' if len(off) == len(day) else f"{','.join(off)} 결시"
            if not (t.get('isMain') or t.get('isSub') or t.get('isHallway')
                    or any(t.get(f'isClass{g}', True) for g in (1, 2, 3))):
                return '특수·분리 전담'
            return ''

        def who(ts, date, n):
            names = [t['name'] + (f"({reason(t, date)})" if reason(t, date) else '') for t in ts]
            return ', '.join(names[:5]) + (f" 외 {len(names) - 5}명" if len(names) > 5 else '') + f" {n}회"

        for date in sorted(set(p['date'] for p in periods)):
            # 그날 종일 결시한 교사는 비교에서 뺀다.
            counts = {t['id']: daily_counts.get(date, {}).get(t['id'], 0) for t in active_teachers
                      if reason(t, date) != '종일 결시'}
            if counts:
                day_max, day_min = max(counts.values()), min(counts.values())
                if day_max - day_min > max_diff:
                    most = [t for t in active_teachers if counts.get(t['id']) == day_max]
                    least = [t for t in active_teachers if counts.get(t['id']) == day_min]
                    fail(10,
                        f"[{date}] 1일 감독 횟수 편차 {day_max - day_min}회 발생 (허용:{max_diff}회)"
                        f" — 최다: {who(most, date, day_max)} / 최소: {who(least, date, day_min)}")

    return {"all_pass": all(c['pass'] for c in checks), "checks": checks}


def build_stats(teachers, assignments, rules):
    """교사별 배정 통계를 라벨 기준으로 집계한다.

    자동배정 직후와 재검증 후가 같은 함수를 쓰므로 숫자가 어긋날 수 없다.
    """
    weight_of = {ROLE_COL[k]: int(rules.get(f'fatigue{n}', d))
                 for k, n, d in [('정', 'Main', 5), ('부', 'Sub', 3), ('수업', 'Class', 1),
                                 ('복도', 'Hall', 2), ('분리', 'Sep', 4), ('특수', 'Sp', 4)]}

    stats, counts = [], []
    for t in teachers:
        row = {c: 0 for c in ROLE_COL.values()}
        total = 0
        for label in assignments.get(t['id'], {}).values():
            if not label or label == '-':
                continue
            total += 1
            row[ROLE_COL[role_key(label)]] += 1
        if total > 0:
            counts.append(total)
        workload = sum(row[c] * weight_of[c] for c in row)
        stats.append({"name": t['name'], "total": total, "workload": workload, **row})

    by_fatigue = rules.get('balanceStrategy', 'FATIGUE') == 'FATIGUE'
    stats.sort(key=lambda x: (x['workload'], x['total']) if by_fatigue else (x['total'], x['workload']),
               reverse=True)
    return stats, counts


def summarize(teachers, periods, assignments, classSubjects, rules, logs, shortage=False):
    """검증 탭이 그대로 쓰는 validation 딕셔너리를 만든다."""
    stats, counts = build_stats(teachers, assignments, rules)
    return {
        "shortage": shortage,
        "logs": logs,
        "avg": round(sum(counts) / len(counts), 1) if counts else 0,
        "std_dev": round(statistics.stdev(counts), 2) if len(counts) > 1 else 0,
        "max": max(counts) if counts else 0,
        "min": min(counts) if counts else 0,
        "stats": stats,
        "verify": generate_verify_data(teachers, periods, assignments, classSubjects, rules),
    }
