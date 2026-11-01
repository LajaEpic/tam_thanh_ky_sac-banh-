with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

idx = html.find('audioFile')
if idx != -1:
    with open('audio_html.txt', 'w', encoding='utf-8') as out:
        out.write(html[max(0, idx - 400):min(len(html), idx + 400)])
    print("Found audioFile in HTML")
else:
    print("audioFile not found")
