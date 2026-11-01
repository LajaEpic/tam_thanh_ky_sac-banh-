import json

with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract control and stage scripts
def extract_script(name):
    tag = f"if(mode==='{name}'){{(new Function("
    idx = html.find(tag)
    if idx == -1: return ""
    end_tag = html.find("))()}", idx)
    content = html[idx + len(tag):end_tag]
    return json.loads(content)

with open('control_code.js', 'w', encoding='utf-8') as f:
    f.write(extract_script('control'))

with open('stage_code.js', 'w', encoding='utf-8') as f:
    f.write(extract_script('stage'))

print("Extracted control_code.js and stage_code.js")
