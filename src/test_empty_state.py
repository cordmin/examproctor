"""Startup, close confirmation and revalidation must preserve user data."""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch
import main


def check():
    with TemporaryDirectory() as folder:
        api = main.Api.__new__(main.Api)
        api.data_file = str(Path(folder) / 'new.json')
        assert api.load_data() == main.EMPTY_DATA
        assert api.revalidate(copy.deepcopy(main.EMPTY_DATA))["validation"] == {}
        data = json.loads(Path(__file__).with_name('시험감독_배정결과(예시).json').read_text(encoding='utf-8'))
        original = copy.deepcopy(data)
        result = api.revalidate(data)
        assert result['success']
        assert data['assignments'] == original['assignments']
        assert result['validation']['stats'] == original['validation']['stats']
        data['validation']['shortage'] = True
        assert not api.revalidate(data)['validation']['shortage']
        for dirty, answer, saved, should_close in [
            (False, 2, False, True), (True, 2, False, False),
            (True, 7, False, True), (True, 6, False, False), (True, 6, True, True),
        ]:
            api._allow_close = False
            api._win = Mock()
            api._win.evaluate_js.return_value = {'dirty': dirty, 'data': original}
            api.close_window = Mock()
            api.save_data_dialog = Mock(return_value={'success': saved, 'canceled': not saved})
            message = Mock(return_value=answer)
            with patch.object(main.ctypes, 'windll', SimpleNamespace(user32=SimpleNamespace(MessageBoxW=message))):
                api._confirm_close()
            assert api.close_window.called == should_close, (dirty, answer, saved)
            assert api.save_data_dialog.called == (dirty and answer == 6)
            if dirty and answer == 6:
                assert api.save_data_dialog.call_args.args[0] == original
        api._ask_open = Mock(return_value=None)
        api.load_data_dialog()
        assert api._ask_open.call_args.args[1] == str(Path(main.__file__).resolve().parent.parent)
    print('PASS: empty install, revalidation preserves all 291 assignments/counts, stale shortage cleared, close save/discard/cancel, installation folder')

if __name__ == '__main__':
    check()
