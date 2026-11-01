with open('control_code.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('video_audio_control.txt', 'w', encoding='utf-8') as out:
    for i in range(215, 250):
        if i < len(lines):
            out.write(f"{i+1}: {lines[i]}")
