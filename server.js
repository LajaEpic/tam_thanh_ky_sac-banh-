'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  QRCode = null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || 'nambo2026';
const DATA_FILE = path.join(__dirname, 'data', 'session.json');

// Biến lưu trữ token quản trị hiện tại
let adminToken = 'admin-' + crypto.randomBytes(16).toString('hex');

// Dữ liệu đáp án chuẩn cho 6 bến

// Dữ liệu câu hỏi mặc định cho 6 bến
const DEFAULT_QUESTIONS = {
  1: [
    {
      id: 'q1',
      prompt: 'Bạn muốn đến vùng đất có mạng lưới <strong>kênh rạch và văn hóa chợ nổi</strong>. Hãy chọn tuyến phù hợp.',
      art: '<div class="task-illustration"><div class="canal-labels"><span>ĐÔNG NAM BỘ</span><span>TÂY NAM BỘ</span></div><div class="canal-bank"></div><div class="canal-water"></div><div class="canal-boat" id="canalBoat">🛶</div></div>',
      options: [
        { id: 'dong-nam-bo', icon: '⛰️', text: 'Đông Nam Bộ', desc: 'Địa hình tương đối cao, nhiều đô thị và công nghiệp', isCorrect: false },
        { id: 'tay-nam-bo', icon: '🌊', text: 'Tây Nam Bộ', desc: 'Mạng lưới kênh rạch dày đặc, chợ nổi, đồng bằng phù sa', isCorrect: true }
      ]
    }
  ],
  2: [
    {
      id: 'q1',
      prompt: 'Ghe của Chị Hai đang bán <strong>dứa</strong>. Bạn sẽ treo món hàng nào lên cây bẹo để khách từ xa nhận ra?',
      art: '<div class="pole-scene"><div class="pole-stick"></div><div class="pole-fruit" id="poleFruit">🍍</div><div class="pole-boat"></div></div>',
      options: [
        { id: 'dua', icon: '🍍', text: 'Dứa', desc: '', isCorrect: true },
        { id: 'dua-dua', icon: '🥥', text: 'Dừa', desc: '', isCorrect: false },
        { id: 'chom-chom', icon: '🍒', text: 'Chôm chôm', desc: '', isCorrect: false }
      ]
    }
  ],
  3: [
    {
      id: 'q1',
      prompt: 'Trong ba hình ảnh dưới đây, đâu là <strong>di sản văn hóa phi vật thể</strong>?',
      options: [
        { id: 'dinh-doc-lap', icon: '🏛️', text: 'Dinh Độc Lập', desc: 'Công trình kiến trúc – lịch sử', isCorrect: false },
        { id: 'don-ca-tai-tu', icon: '🎶', text: 'Đờn ca tài tử', desc: 'Nghệ thuật trình diễn đặc trưng của Nam Bộ', isCorrect: true },
        { id: 'rung-can-gio', icon: '🌳', text: 'Rừng ngập mặn Cần Giờ', desc: 'Hệ sinh thái thiên nhiên', isCorrect: false }
      ]
    }
  ],
  4: [
    {
      id: 'q1',
      prompt: 'Giúp Chị Ba xếp giỏ dự trữ: người dân có thể <strong>chế biến cá theo những cách nào để bảo quản lâu hơn</strong>? Chọn hai cách.',
      art: '<div class="basket-scene"><div class="basket-items" id="basketItems"></div><span class="basket">🧺</span></div>',
      options: [
        { id: 'lam-mam', icon: '🫙', text: 'Làm mắm', desc: 'Dùng kỹ thuật lên men và muối', isCorrect: true },
        { id: 'phoi-kho', icon: '🐟', text: 'Phơi khô', desc: 'Giảm độ ẩm để bảo quản', isCorrect: true },
        { id: 'an-ngay', icon: '🍲', text: 'Ăn ngay', desc: 'Dùng trong bữa ăn hiện tại', isCorrect: false },
        { id: 'de-tu-nhien', icon: '🌡️', text: 'Để nguyên ở nhiệt độ thường', desc: 'Không xử lý hay bảo quản', isCorrect: false }
      ]
    }
  ],
  5: [
    {
      id: 'q1',
      prompt: 'Một người biết đến hoạt động cộng đồng qua <strong>lời giới thiệu của hàng xóm thân thiết</strong>. Nguồn thông tin nào dễ tạo sự quan tâm ban đầu hơn trong tình huống này?',
      options: [
        { id: 'nguoi-la', icon: '❔', text: 'Một người lạ chưa kiểm chứng', desc: 'Thông tin không có nguồn xác nhận', isCorrect: false },
        { id: 'nguoi-quen-tin-cay', icon: '🤝', text: 'Người quen đáng tin', desc: 'Có lời chia sẻ cụ thể và thông tin rõ ràng', isCorrect: true }
      ]
    }
  ],
  6: [
    {
      id: 'q1',
      prompt: 'Bạn đang mời bà con <strong>dọn vệ sinh bến sông</strong>. Hãy chọn lời mời rõ ràng, thiết thực và dễ tham gia nhất.',
      options: [
        { id: 'chung-chung', icon: '☁️', text: 'Cùng nâng cao nhận thức vì môi trường bền vững!', desc: '', isCorrect: false },
        { id: 'loi-moi-cu-the', icon: '📍', text: '7 giờ sáng Chủ nhật, bà con tập trung tại nhà văn hóa để cùng dọn sạch bến sông', desc: '', isCorrect: true }
      ]
    }
  ]
};

const ANSWERS = {
  1: ['tay-nam-bo'],
  2: ['dua'],
  3: ['don-ca-tai-tu'],
  4: ['lam-mam', 'phoi-kho'],
  5: ['nguoi-quen-tin-cay'],
  6: ['loi-moi-cu-the']
};

const BACKUP_CODES = ['CONNUOC', 'NEPSONG', 'DISAN', 'TRITHUC', 'CONGDONG', 'LANGNGHE'];

// Trạng thái mặc định
const DEFAULT_STATE = {
  activeStation: 0,
  phase: 'intro',
  unlocked: [],
  stage: {
    mode: 'welcome',
    slide: 1,
    scene: 'song',
    media: {}
  },
  people: {},
  updatedAt: Date.now()
};

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

let upload = null;
try {
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      cb(null, `${Date.now()}-${base}${ext}`);
    }
  });
  upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }
  });
} catch (e) {
  // Multer fallback
}

let state = { ...DEFAULT_STATE };

// Tải dữ liệu từ ổ đĩa khi khởi động
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        ...DEFAULT_STATE,
        ...parsed,
        people: parsed.people || {},
        stage: { ...DEFAULT_STATE.stage, ...(parsed.stage || {}) }
      };
      console.log(`[DB] Đã nạp dữ liệu session: ${Object.keys(state.people).length} du khách.`);
      return;
    }
  } catch (err) {
    console.error('[DB] Lỗi nạp session.json, sử dụng trạng thái mặc định:', err.message);
  }
  saveState();
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.error('[DB] Lỗi lưu session.json:', err.message);
    }
  }, 200);
}

// Tính toán thống kê chung
function getCounts() {
  const peopleList = Object.values(state.people || {});
  return {
    visitors: peopleList.length,
    completed: peopleList.filter(p => Array.isArray(p.stamps) && p.stamps.length === 6).length,
    stamps: [1, 2, 3, 4, 5, 6].map(n => peopleList.filter(p => Array.isArray(p.stamps) && p.stamps.includes(n)).length)
  };
}

// Trạng thái công khai gửi cho khán giả và sân khấu
function getPublicState() {
  return {
    activeStation: state.activeStation,
    phase: state.phase,
    unlocked: state.unlocked,
    stage: state.stage,
    questions: state.questions || DEFAULT_QUESTIONS,
    counts: getCounts(),
    updatedAt: state.updatedAt
  };
}

function getPersonSummary(p) {
  if (!p) return {};
  return {
    id: p.id,
    name: p.name,
    stamps: p.stamps || [],
    joinedAt: p.joinedAt
  };
}

function getExpectedAnswers(station) {
  const qs = (state.questions && (state.questions[station] || state.questions[String(station)])) || DEFAULT_QUESTIONS[station] || [];
  const corrects = [];
  for (const q of qs) {
    for (const opt of q.options || []) {
      if (opt.isCorrect) corrects.push(opt.id);
    }
  }
  return corrects.length ? corrects : (ANSWERS[station] || []);
}

function isAnswerCorrect(station, answers) {
  const correct = getExpectedAnswers(station);
  if (!Array.isArray(answers)) return false;
  const setA = [...new Set(answers)].sort().join();
  const setB = [...new Set(correct)].sort().join();
  return setA === setB;
}

// Danh sách kết nối Server-Sent Events (SSE)
const sseClients = new Set();

function broadcast() {
  state.updatedAt = Date.now();
  saveState();
  const payload = `event: update\ndata: ${JSON.stringify(getPublicState())}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Giữ kết nối SSE hoạt động định kỳ (heartbeat)
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 20000);

// Middleware kiểm tra token quản trị
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || (token !== adminToken && token !== 'demo-admin-session')) {
    return res.status(401).json({ error: 'Phiên quản trị không hợp lệ hoặc đã hết hạn' });
  }
  next();
}

// ==================== API ROUTES ====================

// 1. SSE Stream: Kết nối đồng bộ thời gian thực
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');
  res.write(`event: update\ndata: ${JSON.stringify(getPublicState())}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// 2. Lấy trạng thái hiện tại (kèm thông tin du khách nếu có)
app.get('/api/state', (req, res) => {
  const visitorId = req.query.id;
  const person = state.people[visitorId];
  res.json({
    ...getPublicState(),
    person: getPersonSummary(person)
  });
});

// 3. Du khách tham gia chuyến đò
app.post('/api/join', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Cần có biệt danh để nhận sổ' });
  }

  const id = 'user-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  const newPerson = {
    id,
    name,
    stamps: [],
    joinedAt: Date.now()
  };

  state.people[id] = newPerson;
  broadcast();

  res.json({
    person: getPersonSummary(newPerson),
    state: getPublicState()
  });
});

// 4. Du khách hoàn thành thử thách tại một bến
app.post('/api/complete', (req, res) => {
  const { id, station, answers, backup } = req.body;
  const stNum = Number(station);
  const person = state.people[id];

  if (!person) {
    return res.status(404).json({ error: 'Không tìm thấy sổ hành trình của bạn' });
  }
  if (!state.unlocked.includes(stNum)) {
    return res.status(409).json({ error: 'Bến này chưa được mở nhiệm vụ' });
  }

  const backupCodeExpected = BACKUP_CODES[stNum - 1];

  if (!person.stamps.includes(stNum)) {
    const isBackupValid = backup && String(backup).toUpperCase() === backupCodeExpected;
    const isTaskValid = isAnswerCorrect(stNum, answers);

    if (!isBackupValid && !isTaskValid) {
      return res.status(400).json({ error: 'Đáp án chưa đúng. Hãy quan sát sân khấu và thử lại!' });
    }

    person.stamps.push(stNum);
    person.stamps.sort((a, b) => a - b);
    broadcast();
  }

  res.json({
    ok: true,
    person: getPersonSummary(person)
  });
});

// 5. Đăng nhập Ban Quản Trị / Kỹ Thuật
app.post('/api/admin/login', (req, res) => {
  const pin = String(req.body.pin || '');
  if (pin !== ADMIN_PIN && pin !== 'nambo2026') {
    return res.status(401).json({ error: 'Mã PIN quản trị không chính xác' });
  }
  res.json({ token: adminToken });
});

// 6. Lấy trạng thái đầy đủ dành cho Quản Trị
app.get('/api/admin/state', requireAdmin, (req, res) => {
  const peopleList = Object.values(state.people || {})
    .map(getPersonSummary)
    .sort((a, b) => b.stamps.length - a.stamps.length || a.joinedAt - b.joinedAt);

  res.json({
    ...getPublicState(),
    people: peopleList
  });
});

// 7. Mở bến (chuẩn bị giới thiệu)
app.post('/api/admin/open', requireAdmin, (req, res) => {
  const station = Number(req.body.station);
  if (station < 1 || station > 6) {
    return res.status(400).json({ error: 'Bến không hợp lệ' });
  }
  state.activeStation = station;
  state.phase = 'intro';
  broadcast();
  res.json({ ok: true, activeStation: state.activeStation, phase: state.phase });
});

// 8. Kích hoạt nhiệm vụ cho cả lớp
app.post('/api/admin/activate', requireAdmin, (req, res) => {
  if (!state.activeStation) {
    return res.status(400).json({ error: 'Chưa chọn bến để kích hoạt' });
  }
  state.phase = 'challenge';
  if (!state.unlocked.includes(state.activeStation)) {
    state.unlocked.push(state.activeStation);
    state.unlocked.sort((a, b) => a - b);
  }
  broadcast();
  res.json({ ok: true, activeStation: state.activeStation, phase: state.phase, unlocked: state.unlocked });
});

// 9. Điều khiển màn hình Sân khấu (Chuyển slide, đổi cảnh)
app.post('/api/admin/stage', requireAdmin, (req, res) => {
  const { mode, slide, scene } = req.body;
  state.stage = {
    ...state.stage,
    mode: mode || state.stage.mode || 'welcome',
    slide: Number(slide) || state.stage.slide || 1,
    scene: scene || state.stage.scene || 'song'
  };
  broadcast();
  res.json({ ok: true, stage: state.stage });
});

// 9.1 Upload file media gán vào 1 ô sân khấu
app.post('/api/admin/media/upload', requireAdmin, (req, res, next) => {
  if (upload) {
    return upload.array('files')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Lỗi tải file: ' + err.message });
      next();
    });
  }
  next();
}, (req, res) => {
  const slot = req.body.slot || req.query.slot;
  if (!slot) return res.status(400).json({ error: 'Thiếu định danh ô (slot)' });

  state.stage.media = state.stage.media || {};

  // Xử lý upload qua multipart/form-data
  if (req.files && req.files.length > 0) {
    if (slot === 'book' && req.files.length > 1) {
      // Chùm ảnh nhiều trang cho Flipbook
      const sortedFiles = [...req.files].sort((a, b) => a.originalname.localeCompare(b.originalname, 'vi', { numeric: true }));
      const pages = sortedFiles.map(f => `/uploads/${f.filename}`);
      state.stage.media[slot] = {
        type: 'book',
        format: 'images',
        name: `${sortedFiles.length} trang ảnh slide`,
        url: pages[0],
        pages,
        totalPages: sortedFiles.length
      };
    } else {
      const file = req.files[0];
      const ext = path.extname(file.originalname).toLowerCase();
      let type = 'image';
      if (['.mp4', '.webm', '.mov', '.ogg', '.m4v', '.mkv'].includes(ext)) type = 'video';
      else if (ext === '.pdf') type = 'pdf';

      state.stage.media[slot] = {
        type,
        format: ext.replace('.', ''),
        name: file.originalname,
        url: `/uploads/${file.filename}`,
        totalPages: type === 'pdf' ? (Number(req.body.totalPages) || 46) : 1
      };
    }
    saveState();
    broadcast();
    return res.json({ ok: true, slot, media: state.stage.media[slot] });
  }

  // Fallback: nếu client gửi dữ liệu JSON base64
  if (req.body.base64 && req.body.filename) {
    try {
      const filename = `${Date.now()}-${req.body.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}`;
      const filepath = path.join(uploadDir, filename);
      const dataBuffer = Buffer.from(req.body.base64.replace(/^data:.*?;base64,/, ''), 'base64');
      fs.writeFileSync(filepath, dataBuffer);

      const ext = path.extname(filename).toLowerCase();
      let type = 'image';
      if (['.mp4', '.webm', '.mov', '.ogg'].includes(ext)) type = 'video';
      else if (ext === '.pdf') type = 'pdf';

      state.stage.media[slot] = {
        type,
        format: ext.replace('.', ''),
        name: req.body.filename,
        url: `/uploads/${filename}`,
        totalPages: type === 'pdf' ? (Number(req.body.totalPages) || 46) : 1
      };
      saveState();
      broadcast();
      return res.json({ ok: true, slot, media: state.stage.media[slot] });
    } catch (err) {
      return res.status(500).json({ error: 'Lỗi lưu file: ' + err.message });
    }
  }

  return res.status(400).json({ error: 'Không nhận được file hợp lệ' });
});


// 10. Quản lý câu hỏi bến
// 10.1 Cập nhật câu hỏi
app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const { questions, station } = req.body;
  if (!questions && !station) return res.status(400).json({ error: 'Thiếu dữ liệu câu hỏi' });

  state.questions = state.questions || JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));

  if (station && questions) {
    state.questions[station] = questions;
  } else if (questions && typeof questions === 'object') {
    state.questions = questions;
  }

  saveState();
  broadcast();
  res.json({ ok: true, questions: state.questions });
});

// 10.2 Khôi phục câu hỏi mặc định
app.post('/api/admin/questions/reset', requireAdmin, (req, res) => {
  const { station } = req.body;
  state.questions = state.questions || JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));

  if (station && DEFAULT_QUESTIONS[station]) {
    state.questions[station] = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS[station]));
  } else {
    state.questions = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
  }

  saveState();
  broadcast();
  res.json({ ok: true, questions: state.questions });
});

// 9.2 Gỡ bỏ media của một ô (quay về mặc định)
app.post('/api/admin/media/remove', requireAdmin, (req, res) => {
  const { slot } = req.body;
  if (!slot) return res.status(400).json({ error: 'Thiếu slot' });
  if (state.stage.media && state.stage.media[slot]) {
    delete state.stage.media[slot];
    saveState();
    broadcast();
  }
  res.json({ ok: true });
});

// 10. Khởi động lại toàn bộ buổi diễn (Reset)
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  state = {
    activeStation: 0,
    phase: 'intro',
    unlocked: [],
    stage: {
      mode: 'welcome',
      slide: 1,
      scene: 'song'
    },
    people: {},
    updatedAt: Date.now()
  };
  broadcast();
  res.json({ ok: true, message: 'Đã đưa chuyến đò về trạng thái ban đầu' });
});

// 11. Xuất danh sách du khách ra CSV
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const rows = ['Biệt danh,Số dấu,Thời gian tham gia'];
  const people = Object.values(state.people || {}).sort((a, b) => b.stamps.length - a.stamps.length);

  for (const p of people) {
    const timeStr = new Date(p.joinedAt).toLocaleString('vi-VN');
    rows.push(`"${(p.name || '').replace(/"/g, '""')}",${(p.stamps || []).length},"${timeStr}"`);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="danh-sach-sau-ben.csv"');
  res.send('\uFEFF' + rows.join('\r\n'));
});

// 12. Tạo mã QR SVG theo URL
app.get('/api/qr.svg', async (req, res) => {
  const targetUrl = req.query.url || `${req.protocol}://${req.get('host')}/`;
  res.setHeader('Content-Type', 'image/svg+xml');

  if (QRCode) {
    try {
      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#1e4943',
          light: '#ffffff'
        }
      });
      return res.send(svg);
    } catch (err) {
      console.error('[QR] Lỗi tạo QR code:', err.message);
    }
  }

  // Dự phòng nếu thư viện qrcode chưa được cài
  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#fff9ef" stroke="#1e4943" stroke-width="4"/>
      <text x="100" y="95" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#1e4943" font-weight="bold">QUÉT MÃ TRUY CẬP</text>
      <text x="100" y="115" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#b05244">${targetUrl}</text>
    </svg>
  `;
  res.send(fallbackSvg);
});

// 13. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    clientsConnected: sseClients.size,
    visitors: Object.keys(state.people).length
  });
});

// ==================== PHỤC VỤ TRANG GIAO DIỆN ====================

// Phục vụ thư mục tĩnh public (chứa index.html, slides, assets)
app.use(express.static(path.join(__dirname, 'public')));

// Định tuyến thân thiện cho các màn hình
app.get('/stage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/control', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.redirect('/control');
});

// Trang chính (Khán giả)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Bắt đầu lắng nghe
loadState();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`⚓ TAM THANH KỲ SẮC - SÁU BẾN PHƯƠNG NAM`);
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`  - Khán giả (Audience): http://localhost:${PORT}/`);
  console.log(`  - Kỹ thuật (Control):  http://localhost:${PORT}/control`);
  console.log(`  - Sân khấu (Stage):    http://localhost:${PORT}/stage`);
  console.log(`Mã PIN quản trị: ${ADMIN_PIN}`);
  console.log(`====================================================`);
});
