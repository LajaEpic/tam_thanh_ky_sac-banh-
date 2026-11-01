import re

for filename in ['control_code.js', 'stage_code.js']:
    with open(filename, 'r', encoding='utf-8') as f:
        code = f.read()
    print(f"=== {filename} ===")
    for kw in ['media', 'stageassets', 'broadcastchannel', 'audio', 'sound', 'music', 'upload']:
        matches = [m.start() for m in re.finditer(kw, code, re.IGNORECASE)]
        print(f"Keyword '{kw}': {len(matches)} matches")

