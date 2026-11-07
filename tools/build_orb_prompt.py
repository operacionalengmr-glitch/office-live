"""Copies orb-prompt.txt (repo root) into supabase/functions/orb-chat/prompt.ts.

Supabase only uploads code files with a function, so the orb's prompt is turned into a .ts module.
Edit orb-prompt.txt, run `python tools/build_orb_prompt.py`, then redeploy the orb-chat function.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
text = (root / 'orb-prompt.txt').read_text(encoding='utf-8').strip()
out = root / 'supabase' / 'functions' / 'orb-chat' / 'prompt.ts'
out.write_text(
    '// Generated from orb-prompt.txt by tools/build_orb_prompt.py. Do not edit here: edit the .txt and run the script.\n'
    f'export default {json.dumps(text, ensure_ascii=False)};\n',
    encoding='utf-8',
)
print(f'{out.relative_to(root)} updated ({len(text)} chars)')
