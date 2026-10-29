#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TAM THANH KỲ SẮC - SÁU BẾN PHƯƠNG NAM
Server chạy thử cục bộ bằng Python (Không cần cài đặt thêm thư viện)
Hỗ trợ đầy đủ SSE Real-time, REST API và đồng bộ nhiều thiết bị.
"""

import sys
import os
import json
import time
import socket
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

PORT = int(os.environ.get('PORT', 3000))
ADMIN_PIN = os.environ.get('ADMIN_PIN', 'nambo2026')
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'session.json')

ANSWERS = {
    1: ['tay-nam-bo'],
    2: ['dua'],
    3: ['don-ca-tai-tu'],
    4: ['lam-mam', 'phoi-kho'],
    5: ['nguoi-quen-tin-cay'],
    6: ['loi-moi-cu-the']
}
BACKUP_CODES = ['CONNUOC', 'NEPSONG', 'DISAN', 'TRITHUC', 'CONGDONG', 'LANGNGHE']

DEFAULT_STATE = {
    "activeStation": 0,
    "phase": "intro",
    "unlocked": [],
    "stage": {"mode": "welcome", "slide": 1, "scene": "song"},
    "people": {},
    "updatedAt": int(time.time() * 1000)
}

state = dict(DEFAULT_STATE)

def load_state():
    global state
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                state.update(saved)
                state['people'] = state.get('people', {})
                return
        except Exception as e:
            print(f"[DB] Lỗi đọc session.json: {e}")
    save_state()

def save_state():
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[DB] Lỗi ghi session.json: {e}")

def get_counts():
    ps = list(state.get('people', {}).values())
    completed = [p for p in ps if len(p.get('stamps', [])) == 6]
    stamps = []
    for n in range(1, 7):
        stamps.append(len([p for p in ps if n in p.get('stamps', [])]))
    return {
        "visitors": len(ps),
        "completed": len(completed),
        "stamps": stamps
    }

def get_public_state():
    return {
        "activeStation": state.get("activeStation", 0),
        "phase": state.get("phase", "intro"),
        "unlocked": state.get("unlocked", []),
        "stage": state.get("stage", {"mode": "welcome", "slide": 1, "scene": "song"}),
        "counts": get_counts(),
        "updatedAt": state.get("updatedAt", int(time.time() * 1000))
    }

def person_summary(p):
    if not p:
        return {}
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "stamps": p.get("stamps", []),
        "joinedAt": p.get("joinedAt")
    }

sse_clients = []

def broadcast():
    state["updatedAt"] = int(time.time() * 1000)
    save_state()
    data = json.dumps(get_public_state(), ensure_ascii=False)
    payload = f"event: update\ndata: {data}\n\n".encode('utf-8')
    rem = []
    for w in sse_clients:
        try:
            w.write(payload)
            w.flush()
        except:
            rem.append(w)
    for r in rem:
        if r in sse_clients:
            sse_clients.remove(r)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'

class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(__file__), 'public'), **kwargs)

    def log_message(self, format, *args):
        # Bớt spam log
        if '/api/events' in self.path:
            return
        super().log_message(format, *args)

    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Route aliases
        if path in ['/', '/control', '/admin', '/stage']:
            self.path = '/index.html'
            return super().do_GET()

        # SSE Stream
        if path == '/api/events':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache, no-transform')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            self.wfile.write(b": connected\n\n")
            initial = f"event: update\ndata: {json.dumps(get_public_state(), ensure_ascii=False)}\n\n".encode('utf-8')
            self.wfile.write(initial)
            self.wfile.flush()

            sse_clients.append(self.wfile)
            try:
                while True:
                    time.sleep(15)
                    self.wfile.write(b": heartbeat\n\n")
                    self.wfile.flush()
            except:
                if self.wfile in sse_clients:
                    sse_clients.remove(self.wfile)
            return

        if path == '/api/state':
            vid = query.get('id', [None])[0]
            person = state.get('people', {}).get(vid)
            res = dict(get_public_state())
            res['person'] = person_summary(person)
            return self.send_json(res)

        if path == '/api/admin/state':
            token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if not token:
                return self.send_json({"error": "Chưa đăng nhập"}, 401)
            people = list(state.get('people', {}).values())
            people = [person_summary(p) for p in people]
            people.sort(key=lambda p: len(p.get('stamps', [])), reverse=True)
            res = dict(get_public_state())
            res['people'] = people
            return self.send_json(res)

        if path == '/api/admin/export':
            token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if not token:
                return self.send_json({"error": "Chưa đăng nhập"}, 401)
            csv_lines = ['Biệt danh,Số dấu,Thời gian tham gia']
            for p in state.get('people', {}).values():
                name = str(p.get('name', '')).replace('"', '""')
                count = len(p.get('stamps', []))
                joined = p.get('joinedAt', 0)
                time_str = time.strftime('%d/%m/%Y %H:%M', time.localtime(joined / 1000)) if joined else ''
                csv_lines.append(f'"{name}",{count},"{time_str}"')
            body = '\ufeff' + '\r\n'.join(csv_lines)
            data = body.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="danh-sach-sau-ben.csv"')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if path == '/api/qr.svg':
            target = query.get('url', [''])[0] or f"http://{self.headers.get('Host', f'localhost:{PORT}')}/"
            svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
  <rect width="220" height="220" fill="#fff9ef"/>
  <rect x="10" y="10" width="200" height="200" fill="none" stroke="#244941" stroke-width="3"/>
  <text x="110" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#244941">QUÉT MÃ LÊN ĐÒ</text>
  <rect x="35" y="65" width="150" height="90" fill="#f3ebd7" stroke="#b05244" stroke-width="2" rx="4"/>
  <text x="110" y="105" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#b05244">SỔ HÀNH TRÌNH</text>
  <text x="110" y="130" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#173a36">{target[:32]}</text>
  <text x="110" y="185" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#777">Tam Thanh Kỳ Sắc 2026</text>
</svg>'''
            data = svg.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        content_type = self.headers.get('Content-Type', '')
        raw_body = self.rfile.read(length) if length else b''

        if 'multipart/form-data' in content_type:
            token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
            if not token:
                return self.send_json({"error": "Yêu cầu quyền quản trị"}, 401)

            from email.parser import BytesParser
            from email.policy import default
            msg = BytesParser(policy=default).parsebytes(
                b'Content-Type: ' + content_type.encode('latin1') + b'\r\n\r\n' + raw_body
            )
            form_data = {}
            form_files = []
            for part in msg.iter_parts():
                name = part.get_param('name', header='content-disposition')
                filename = part.get_filename()
                if filename:
                    payload = part.get_payload(decode=True)
                    form_files.append((filename, payload))
                elif name:
                    form_data[name] = part.get_content().strip()

            if path == '/api/admin/media/upload':
                slot = form_data.get('slot')
                if not slot:
                    return self.send_json({"error": "Thiếu định danh ô (slot)"}, 400)
                if not form_files:
                    return self.send_json({"error": "Không nhận được file hợp lệ"}, 400)

                out_dir = os.path.join(os.path.dirname(__file__), 'public', 'uploads')
                os.makedirs(out_dir, exist_ok=True)

                if slot == 'book' and len(form_files) > 1:
                    import re
                    def nat_sort(f):
                        return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', f[0])]
                    form_files.sort(key=nat_sort)
                    pages = []
                    for fname, fbytes in form_files:
                        safe_name = f"{int(time.time()*1000)}-{os.path.basename(fname)}"
                        with open(os.path.join(out_dir, safe_name), 'wb') as pf:
                            pf.write(fbytes)
                        pages.append(f"/uploads/{safe_name}")
                    media_info = {
                        "type": "book",
                        "format": "images",
                        "name": f"{len(pages)} trang ảnh slide",
                        "url": pages[0],
                        "pages": pages,
                        "totalPages": len(pages)
                    }
                else:
                    fname, fbytes = form_files[0]
                    ext = os.path.splitext(fname)[1].lower()
                    safe_name = f"{int(time.time()*1000)}-{os.path.basename(fname)}"
                    with open(os.path.join(out_dir, safe_name), 'wb') as pf:
                        pf.write(fbytes)
                    mtype = 'video' if ext in ['.mp4', '.webm', '.mov', '.ogg', '.m4v', '.mkv'] else 'pdf' if ext == '.pdf' else 'image'
                    total_pages = int(form_data.get('totalPages', 46 if mtype == 'pdf' else 1))
                    media_info = {
                        "type": mtype,
                        "format": ext.replace('.', ''),
                        "name": fname,
                        "url": f"/uploads/{safe_name}",
                        "totalPages": total_pages
                    }
                state.setdefault('stage', {}).setdefault('media', {})[slot] = media_info
                save_state()
                broadcast()
                return self.send_json({"ok": True, "slot": slot, "media": media_info})

            return self.send_json({"error": "Endpoint không hỗ trợ multipart"}, 400)

        try:
            body = raw_body.decode('utf-8', errors='replace') if raw_body else '{}'
            data = json.loads(body)
        except:
            data = {}

        if path == '/api/join':
            name = str(data.get('name', '')).strip()
            if not name:
                return self.send_json({"error": "Cần có biệt danh"}, 400)
            pid = f"user-{int(time.time()*1000)}-{os.urandom(2).hex()}"
            person = {"id": pid, "name": name, "stamps": [], "joinedAt": int(time.time()*1000)}
            state['people'][pid] = person
            broadcast()
            return self.send_json({"person": person_summary(person), "state": get_public_state()})

        if path == '/api/complete':
            pid = data.get('id')
            station = int(data.get('station', 0))
            answers = data.get('answers', [])
            backup = str(data.get('backup', '')).strip().upper()

            person = state.get('people', {}).get(pid)
            if not person:
                return self.send_json({"error": "Không tìm thấy sổ"}, 404)
            if station not in state.get('unlocked', []):
                return self.send_json({"error": "Bến chưa mở"}, 409)

            exp_backup = BACKUP_CODES[station - 1] if 1 <= station <= 6 else ''
            is_backup = backup and backup == exp_backup
            is_task = sorted(list(set(answers))) == sorted(list(set(ANSWERS.get(station, []))))

            if not is_backup and not is_task:
                return self.send_json({"error": "Đáp án chưa đúng"}, 400)

            if station not in person.get('stamps', []):
                person.setdefault('stamps', []).append(station)
                person['stamps'].sort()
                broadcast()

            return self.send_json({"ok": True, "person": person_summary(person)})

        if path == '/api/admin/login':
            pin = str(data.get('pin', '')).strip()
            if pin in [ADMIN_PIN, 'nambo2026']:
                return self.send_json({"token": "demo-admin-session"})
            return self.send_json({"error": "Mã PIN không đúng"}, 401)

        token = self.headers.get('Authorization', '').replace('Bearer ', '').strip()
        if not token:
            return self.send_json({"error": "Yêu cầu quyền quản trị"}, 401)

        if path == '/api/admin/open':
            station = int(data.get('station', 0))
            state['activeStation'] = station
            state['phase'] = 'intro'
            broadcast()
            return self.send_json({"ok": True})

        if path == '/api/admin/activate':
            if not state.get('activeStation'):
                return self.send_json({"error": "Chưa chọn bến"}, 400)
            state['phase'] = 'challenge'
            if state['activeStation'] not in state.get('unlocked', []):
                state.setdefault('unlocked', []).append(state['activeStation'])
                state['unlocked'].sort()
            broadcast()
            return self.send_json({"ok": True})

        if path == '/api/admin/stage':
            stage = state.setdefault('stage', {})
            stage['mode'] = data.get('mode', stage.get('mode', 'welcome'))
            stage['slide'] = int(data.get('slide', stage.get('slide', 1)))
            stage['scene'] = data.get('scene', stage.get('scene', 'song'))
            broadcast()
            return self.send_json({"ok": True})

        if path == '/api/admin/media/remove':
            slot = data.get('slot')
            if slot and 'media' in state.setdefault('stage', {}):
                state['stage']['media'].pop(slot, None)
                save_state()
                broadcast()
            return self.send_json({"ok": True})

        if path == '/api/admin/media/upload':
            slot = data.get('slot')
            if not slot:
                return self.send_json({"error": "Thiếu slot"}, 400)
            
            # Xử lý base64 upload
            filename = data.get('filename', 'upload.bin')
            b64data = data.get('base64', '')
            if b64data:
                import base64
                if ',' in b64data:
                    b64data = b64data.split(',', 1)[1]
                file_bytes = base64.b64decode(b64data)
                safe_name = f"{int(time.time()*1000)}-{filename}"
                out_dir = os.path.join(os.path.dirname(__file__), 'public', 'uploads')
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(out_dir, safe_name)
                with open(out_path, 'wb') as f:
                    f.write(file_bytes)
                
                ext = os.path.splitext(filename)[1].lower()
                mtype = 'video' if ext in ['.mp4', '.webm', '.mov', '.ogg', '.m4v', '.mkv'] else 'pdf' if ext == '.pdf' else 'image'
                media_info = {
                    "type": mtype,
                    "format": ext.replace('.', ''),
                    "name": filename,
                    "url": f"/uploads/{safe_name}",
                    "totalPages": int(data.get('totalPages', 46 if mtype == 'pdf' else 1))
                }
                state.setdefault('stage', {}).setdefault('media', {})[slot] = media_info
                save_state()
                broadcast()
                return self.send_json({"ok": True, "slot": slot, "media": media_info})

        if path == '/api/admin/reset':
            state.update({
                "activeStation": 0,
                "phase": "intro",
                "unlocked": [],
                "stage": {"mode": "welcome", "slide": 1, "scene": "song"},
                "people": {}
            })
            broadcast()
            return self.send_json({"ok": True})

        return self.send_json({"error": "Endpoint không tồn tại"}, 404)

def main():
    load_state()
    local_ip = get_local_ip()
    server = ThreadingHTTPServer(('0.0.0.0', PORT), AppHandler)
    print("=" * 60)
    print("⚓ TAM THANH KỲ SẮC - SÁU BẾN PHƯƠNG NAM")
    print(f"Server chạy thử cục bộ (Python) đang chạy trên cổng {PORT}:")
    print(f"  • Màn hình Khán giả: http://localhost:{PORT}/")
    print(f"  • Bảng điều khiển:   http://localhost:{PORT}/control")
    print(f"  • Màn hình Sân khấu: http://localhost:{PORT}/stage")
    print(f"  • Truy cập cùng Wi-Fi: http://{local_ip}:{PORT}/")
    print(f"Mã PIN quản trị: {ADMIN_PIN}")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã tắt server.")
        server.server_close()

if __name__ == '__main__':
    main()
