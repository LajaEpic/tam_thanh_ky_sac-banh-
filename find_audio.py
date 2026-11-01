import os, re

keywords = ['nhạc', 'audio', 'sound', 'music', 'mp3', 'bgm', 'media']
files = ['index.html', 'public/index.html', 'server.js', 'run_local.py']

with open('search_results.txt', 'w', encoding='utf-8') as out:
    for filename in files:
        if not os.path.exists(filename):
            continue
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        out.write(f"=== {filename} ===\n")
        for i, line in enumerate(lines):
            for kw in keywords:
                if kw in line.lower():
                    out.write(f"{i+1}: {line.strip()[:160]}\n")
                    break

print("Search completed")
