"""엑셀 양식 생성 / 명단 읽기 / 배정 결과 내보내기.

파일 대화상자는 호출부(Api)가 처리하고 여기서는 경로만 받는다.
webview 에 의존하지 않으므로 단독으로 실행·검증할 수 있다.
"""
import re
from datetime import datetime

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from labels import parse_label, period_num, role_key

def write_template(path, teachers=None):

    wb = Workbook()
    ws = wb.active
    ws.title = "감독명단양식"

    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
    center_align = Alignment(horizontal='center', vertical='center')
    header_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

    ws.append(["성명", "담당교과", "담임", "참고사항"])

    # 지금 화면의 감독 명단을 그대로 담는다. 명단이 비어 있으면 입력 예시 한 줄을 둔다.
    if teachers:
        for t in teachers:
            ws.append([t.get('name', ''), t.get('subject', ''), t.get('homeroom', ''), t.get('notes', '')])
    else:
        ws.append(["김민수", "국어", "1-1", "※ 담임은 '1-1' 과 같은 형태로 입력"])

    max_r = ws.max_row
    for col, width in enumerate([15, 20, 20, 40], start=1):
        ws.column_dimensions[get_column_letter(col)].width = width * 1.6 
    for row in ws.iter_rows(min_row=1, max_row=max_r, min_col=1, max_col=4):
        for cell in row:
            cell.border = thin_border
            cell.alignment = center_align
            if cell.row == 1:
                cell.font = Font(bold=True)
                cell.fill = header_fill
    wb.save(path)
    return {"success": True, "path": path}


def read_teachers(path):
    wb = load_workbook(path, data_only=True)
    ws = wb.active
    teachers = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if not row or not row[0]: continue
        val_0 = str(row[0]).strip()
        if "안내:" in val_0 or val_0 == "성명": continue

        homeroom_raw = str(row[2]).strip() if len(row)>2 and row[2] and str(row[2]) != "None" else ""
        homeroom_clean = ""
        if homeroom_raw:
            m = re.search(r'(\d+)\s*[-/학년]+\s*(\d+)', homeroom_raw)
            if m: homeroom_clean = f"{m.group(1)}-{m.group(2)}"
            else: homeroom_clean = homeroom_raw

        subject = str(row[1]).strip() if len(row)>1 and row[1] and str(row[1]) != "None" else ""
        notes = str(row[3]).strip() if len(row)>3 and row[3] and str(row[3]) != "None" else ""

        teachers.append({
            "name": val_0, "subject": subject, "homeroom": homeroom_clean, "notes": notes,
            "isMain": True, "isSub": True, "isClass1": True, "isClass2": True, "isClass3": True, "isHallway": False, "isSeparated": False, "isSpecial": False
        })
    return teachers


def write_result(appData, path):

    wb = Workbook()

    # --- 엑셀 스타일 정의 ---
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
    center_align = Alignment(horizontal='center', vertical='center')
    center_align_wrap = Alignment(horizontal='center', vertical='center', wrap_text=True)  # 줄바꿈용 서식
    header_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")

    periods_sorted = sorted(appData.get('periods', []), key=lambda x: (x['date'], period_num(x['name'])))
    periods_by_date = {}
    for p in periods_sorted: periods_by_date.setdefault(p['date'], []).append(p)
    dates = sorted(list(periods_by_date.keys()))

    ws1 = wb.active
    ws1.title = "교사별 시간표"
    row1, row2 = ["순", "성명", "총", "정", "부", "복", "분", "수", "특"], ["", "", "", "", "", "", "", "", ""]
    days_kr = ['월','화','수','목','금','토','일']
    for d in dates:
        pl = len(periods_by_date[d])
        dt = datetime.strptime(d, '%Y-%m-%d')
        row1.extend([f"{dt.month}월 {dt.day}일({days_kr[dt.weekday()]})"] + [""]*(pl-1))
        for p in periods_by_date[d]: row2.append(p['name'])
    ws1.append(row1); ws1.append(row2)
    for i in range(1, 10): ws1.merge_cells(start_row=1, start_column=i, end_row=2, end_column=i)
    cidx = 10
    for d in dates:
        pl = len(periods_by_date[d])
        if pl > 1: ws1.merge_cells(start_row=1, start_column=cidx, end_row=1, end_column=cidx+pl-1)
        cidx += pl

    teachers, assigns = appData.get('teachers', []), appData.get('assignments', {})
    for i, t in enumerate(teachers):
        cnt = {'정':0,'부':0,'복도':0,'분리':0,'수업':0,'특수':0}
        trow = [i+1, t['name']]
        for p in periods_sorted:
            a = assigns.get(t['id'], {}).get(p['id'], "")
            if a and a != '-':
                cnt[role_key(a)] += 1
        trow.extend([sum(cnt.values()), cnt['정'], cnt['부'], cnt['복도'], cnt['분리'], cnt['수업'], cnt['특수']])
        for p in periods_sorted: trow.append(assigns.get(t['id'], {}).get(p['id'], "-"))
        ws1.append(trow)

    for col in range(1, ws1.max_column + 1):
        ws1.column_dimensions[get_column_letter(col)].width = 16 if col > 9 else 5 if col == 1 else 12 if col == 2 else 4.5
    for r in ws1.iter_rows():
        for c in r:
            c.border = thin_border
            c.alignment = center_align
            c.number_format = '@'
            if c.row <= 2:
                c.font = Font(bold=True)
                c.fill = header_fill

    ws2 = wb.create_sheet("학급별 시간표")
    cAssign = {}
    for t_id, p_dict in assigns.items():
        tObj = next((t for t in teachers if t['id'] == t_id), None)
        if not tObj: continue
        for p_id, a_label in p_dict.items():
            if not a_label or a_label == '-': continue
            cName, roleStr = parse_label(a_label)
            cAssign.setdefault(cName, {}).setdefault(p_id, []).append(f"{tObj['name']}({roleStr})" if roleStr else tObj['name'])

    row1_c = ["학급"]
    row2_c = [""]
    for d in dates:
        pl = len(periods_by_date[d])
        dt = datetime.strptime(d, '%Y-%m-%d')
        row1_c.extend([f"{dt.month}월 {dt.day}일({days_kr[dt.weekday()]})"] + [""]*(pl-1))
        for p in periods_by_date[d]: row2_c.append(p['name'])

    ws2.append(row1_c)
    ws2.append(row2_c)
    ws2.merge_cells('A1:A2')

    cidx = 2
    for d in dates:
        pl = len(periods_by_date[d])
        if pl > 1: ws2.merge_cells(start_row=1, start_column=cidx, end_row=1, end_column=cidx+pl-1)
        cidx += pl

    def natural_sort_key(s):
        return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

    for cName in sorted(cAssign.keys(), key=natural_sort_key):
        row_data = [cName]
        for p in periods_sorted:
            assigned_list = cAssign[cName].get(p['id'], [])

            def get_sort_key(name_str):
                if '(정)' in name_str:
                    pri = 1
                elif '(부)' in name_str:
                    pri = 2
                elif '(수업)' in name_str or '(수)' in name_str:
                    pri = 3
                else:
                    m = re.search(r'\((\d+)\)', name_str)
                    if m:
                        pri = 10 + int(m.group(1))
                    else:
                        pri = 99
                return (pri, name_str)

            assigned_list.sort(key=get_sort_key)

            # 한 칸에 여러 명이면 줄바꿈으로 잇는다
            row_data.append("\n".join(assigned_list) if assigned_list else "-")
        ws2.append(row_data)

    # 학급별 시간표 셀은 줄바꿈 표시
    for col in range(1, ws2.max_column + 1):
        ws2.column_dimensions[get_column_letter(col)].width = 20 if col > 1 else 16

    for r in ws2.iter_rows():
        for c in r:
            c.border = thin_border
            c.alignment = center_align_wrap  # 줄바꿈 속성이 포함된 서식 적용
            c.number_format = '@'
            if c.row <= 2:
                c.font = Font(bold=True)
                c.fill = header_fill

    wb.save(path)
