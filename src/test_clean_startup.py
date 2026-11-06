"""Installed startup must clear old bundled examples once and preserve user-authored work."""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import main


def installed_api(folder):
    with patch.dict(main.os.environ, {'APPDATA': folder}), patch.object(main.sys, 'frozen', True, create=True):
        return main.Api()


def write_saved(folder, data):
    target = Path(folder) / '시험감독배정' / 'timetable_data.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    return target


def check():
    sources = [Path(__file__).with_name(name) for name in ['sample_data.json', '시험감독_배정결과(예시).json']]
    samples = [json.loads(source.read_text(encoding='utf-8-sig')) for source in sources]
    with TemporaryDirectory() as folder:
        api = installed_api(folder)
        assert api.get_initial_data() == main.EMPTY_DATA
        # Deliberately opening an example after a clean installation must survive restart.
        write_saved(folder, samples[0])
        assert installed_api(folder).get_initial_data() == main.clean_text(samples[0])
    # 현재 제공하는 예시는 기본 수업 값으로 정리됐으므로, 과거 배포본을 복원해 검사한다.
    legacy_example = copy.deepcopy(samples[1])
    legacy_example['config']['subjects'].insert(0, '수업')
    for subjects in legacy_example['classSubjects'].values():
        for grade, subject in subjects.items():
            if subject == '자습':
                subjects[grade] = '수업'
    assert main.legacy_sample_digest(legacy_example) in main.LEGACY_SAMPLE_DIGESTS
    with TemporaryDirectory() as folder:
        target = write_saved(folder, samples[1])
        assert installed_api(folder).get_initial_data() == main.clean_text(samples[1])
        assert not Path(str(target) + '.legacy-example.bak').exists()
    for sample in [samples[0], legacy_example]:
        for normalized in [False, True]:
            with TemporaryDirectory() as folder:
                legacy = copy.deepcopy(sample)
                if normalized:
                    for counts in legacy['config']['invigCounts'].values():
                        counts['special'] = counts['separated'] = 1
                target = write_saved(folder, legacy)
                original_bytes = target.read_bytes()
                api = installed_api(folder)
                assert api.get_initial_data() == main.EMPTY_DATA
                assert json.loads(target.read_text(encoding='utf-8')) == main.EMPTY_DATA
                assert Path(str(target) + '.legacy-example.bak').read_bytes() == original_bytes
                # The migration runs once, so a subsequently opened example stays open.
                write_saved(folder, legacy)
                assert installed_api(folder).get_initial_data() == main.clean_text(legacy)
                assert Path(str(target) + '.legacy-example.bak').read_bytes() == original_bytes
    for kind in ['teacher', 'rule', 'assignment']:
        with TemporaryDirectory() as folder:
            authored = copy.deepcopy(samples[0])
            if kind == 'teacher':
                authored['teachers'][0]['name'] = '사용자 입력 교사'
            elif kind == 'rule':
                authored['config']['rules']['maxConsecutive'] = 1
            else:
                slots = next(iter(authored['assignments'].values()))
                slots[next(iter(slots))] = '사용자 변경 배정'
            target = write_saved(folder, authored)
            assert installed_api(folder).get_initial_data() == main.clean_text(authored), kind
            assert not Path(str(target) + '.legacy-example.bak').exists(), kind
    print('PASS: installed APPDATA startup; fresh install empty; both old examples and normalized copies cleared; byte-exact backup; edited teachers/rules/assignments preserved; explicit example open survives restart')

if __name__ == '__main__':
    check()
