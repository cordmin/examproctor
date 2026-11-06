"""파일에서 온 글자는 어떤 경로로 들어와도 화면 명령이 될 수 없어야 하고, 평범한 자료는 그대로여야 한다."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock

from openpyxl import Workbook

import main

PAYLOAD = '<img src=x onerror="alert(`1`)">\'&#39;'
DANGEROUS = set('<>"\'`&')


def strings(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [text for item in value for text in strings(item)]
    if isinstance(value, dict):
        return [text for key, item in value.items() for text in [key, *strings(item)]]
    return []


def assert_clean(value):
    for text in strings(value):
        assert not DANGEROUS & set(text), text


if __name__ == '__main__':
    plain = {'teachers': [{'id': 'T1', 'name': '홍길동', 'homeroom': '1-3', 'maxPeriods': 3, 'isMain': True,
                           'absences': {'p_2026-05-26_1': {'type': 'ALL', 'target': ''}}}], 'empty': None}
    assert main.clean_text(plain) == plain
    assert_clean(main.clean_text({PAYLOAD: [PAYLOAD, {'name': PAYLOAD}]}))

    with TemporaryDirectory() as folder:
        api = main.Api.__new__(main.Api)
        api.data_file = str(Path(folder) / 'data.json')
        bad = {'teachers': [{'id': PAYLOAD, 'name': PAYLOAD}], 'config': {'subjects': [PAYLOAD]}}

        source = Path(folder) / 'bad.json'
        source.write_text(json.dumps(bad), encoding='utf-8')
        api._ask_open = Mock(return_value=[str(source)])
        opened = api.load_data_dialog()
        assert opened['success']
        assert_clean(opened['data'])
        assert_clean(json.loads(Path(api.data_file).read_text(encoding='utf-8')))

        Path(api.data_file).write_text(json.dumps(bad), encoding='utf-8')
        Path(api.data_file + '.sample-migration.json').write_text('{}', encoding='utf-8')
        assert_clean(api.load_data())

        book = Workbook()
        book.active.append([PAYLOAD, PAYLOAD, PAYLOAD, PAYLOAD])
        sheet = Path(folder) / 'bad.xlsx'
        book.save(sheet)
        api._ask_open = Mock(return_value=[str(sheet)])
        uploaded = api.upload_excel()
        assert uploaded['success'] and uploaded['teachers']
        assert_clean(uploaded['teachers'])

    print('PASS: JSON, autosave, Excel inputs cleaned; plain data unchanged')
