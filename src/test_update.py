"""업데이트는 현재 데이터를 저장하고, 독립 실행 환경으로 설치 파일을 시작해야 한다."""
import contextlib
import ctypes
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch

import main


def test_update_launch():
    for failure in (None, 'download', 'save', 'launch'):
        with TemporaryDirectory() as folder:
            api = main.Api.__new__(main.Api)
            api.data_file = str(Path(folder) / 'data.json')
            api.data = {'previous': True}
            api.close_window = Mock()
            latest = {'config': {'examName': '시험'}, 'teachers': [{'name': '교사'}]}
            dll = Mock(return_value=1)
            popen = Mock()
            if failure == 'launch': popen.side_effect = OSError('실행 실패')
            download = Mock()
            if failure == 'download': download.side_effect = OSError('다운로드 실패')
            original_write = api._write_json
            api._write_json = Mock(side_effect=OSError('저장 실패')) if failure == 'save' else Mock(side_effect=original_write)
            bundle = str(Path(folder) / 'bundle')
            initial_env = dict(os.environ)
            with patch.object(main.urllib.request, 'urlretrieve', download), patch.object(main.tempfile, 'gettempdir', return_value=folder), patch.object(main.subprocess, 'Popen', popen), patch.object(main.sys, '_MEIPASS', bundle, create=True), patch.object(main.ctypes, 'windll', SimpleNamespace(kernel32=SimpleNamespace(SetDllDirectoryW=dll))), contextlib.redirect_stdout(io.StringIO()):
                result = api.install_update('v1.0.99', latest)
            assert os.environ == initial_env
            if failure:
                assert not result['success']
                api.close_window.assert_not_called()
                if failure in ('download', 'save'):
                    popen.assert_not_called()
                    dll.assert_not_called()
                else:
                    assert dll.call_args_list[0].args == (None,)
                    assert dll.call_args_list[-1].args[0].value == bundle
            else:
                assert result['success']
                assert json.loads(Path(api.data_file).read_text(encoding='utf-8')) == latest
                api.close_window.assert_called_once()
                command = popen.call_args.args[0]
                options = popen.call_args.kwargs
                assert '/FORCECLOSEAPPLICATIONS' in command and '/NORESTARTAPPLICATIONS' in command
                assert f'/LOG={Path(folder) / "update-install.log"}' in command
                assert options['env']['PYINSTALLER_RESET_ENVIRONMENT'] == '1'
                assert options['cwd'] == os.path.dirname(main.sys.executable)
                assert dll.call_args_list[0].args == (None,)
                assert dll.call_args_list[-1].args[0].value == bundle


if __name__ == '__main__':
    test_update_launch()
    print('PASS: save before close, independent installer environment, DLL path reset/restore, logging, forced close, failure keeps app open')
