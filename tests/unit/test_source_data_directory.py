"""Source runs must keep runtime state out of src and use one directory from any cwd."""
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src'))
from main import Api

with TemporaryDirectory() as directory:
    data_dir = Path(directory) / 'data'
    with patch.dict(os.environ, {'EXAMPROCTOR_DATA_DIR': str(data_dir)}):
        api = Api()
        assert Path(api.data_file) == data_dir / 'timetable_data.json'
        assert Path(api.window_file).parent == data_dir
        assert Path(api.settings_file).parent == data_dir
        assert api.data['teachers'] == []
        api._write_json(api.data_file, {'teachers': [{'name': '보존 검사'}]})
        assert Api().data['teachers'][0]['name'] == '보존 검사'
print('PASS: absolute isolated source runtime directory, settings together, saved input preserved')
