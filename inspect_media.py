with open('control_code.js', 'r', encoding='utf-8') as f:
    c_lines = f.readlines()

with open('stage_code.js', 'r', encoding='utf-8') as f:
    s_lines = f.readlines()

with open('media_inspection.txt', 'w', encoding='utf-8') as out:
    out.write("=== CONTROL CODE ===\n")
    for i, l in enumerate(c_lines):
        if any(w in l.lower() for w in ['stageassets', 'broadcastchannel', 'audio', 'upload', 'idb']):
            out.write(f"{i+1}: {l.strip()[:140]}\n")

    out.write("\n=== STAGE CODE ===\n")
    for i, l in enumerate(s_lines):
        if any(w in l.lower() for w in ['stageassets', 'broadcastchannel', 'audio', 'idb', 'media']):
            out.write(f"{i+1}: {l.strip()[:140]}\n")

print("Inspection file written")
