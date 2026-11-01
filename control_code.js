'use strict';
const IDB='ttks.sauBen.stageAssets';
const assetChannel=('BroadcastChannel' in window)?new BroadcastChannel('ttks_assets'):null;
let localMediaMap={};
async function saveSlotMedia(slot,kind,file){try{const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put({kind,blob:file,name:file.name},slot);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}catch{}}
async function loadSlotMediaMap(){try{const db=await openDB();const store=db.transaction('assets','readonly').objectStore('assets');const slots=['book','scene_song','scene_cho','scene_cuchi','scene_khmer','scene_gianbep','scene_thongdiep','video'];for(const slot of slots){const item=await new Promise(res=>{const r=store.get(slot);r.onsuccess=()=>res(r.result);r.onerror=()=>res(null)});if(item&&item.blob){localMediaMap[slot]={type:item.kind,name:item.name,url:URL.createObjectURL(item.blob)}}}db.close();updateMediaIndicators()}catch{}}
function getCardSlot(btn){const m=btn.dataset.mode,s=btn.dataset.scene;if(m==='book')return 'book';if(m==='video')return 'video';if(m==='scene'&&s)return 'scene_'+s;return null}
function updateMediaIndicators(){document.querySelectorAll('.projection-mode').forEach(btn=>{const slot=getCardSlot(btn);if(!slot)return;const hasMedia=(state?.stage?.media&&state.stage.media[slot])||localMediaMap[slot];btn.classList.toggle('has-media',!!hasMedia)})}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(IDB,1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveAssets(kind,blobs){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets');store.clear();store.put({kind,blobs},'slides');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch{}}
function readFileAsB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
async function convertPdfToSlideImages(file,maxPages=46){
 if(!window.pdfjsLib)return null;
 try{
  const buffer=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buffer}).promise;
  const count=Math.min(maxPages,pdf.numPages);
  const images=[];
  for(let i=1;i<=count;i++){
   const page=await pdf.getPage(i);
   const vp=page.getViewport({scale:2.0});
   const cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
   await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
   const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.92));
   blob.name='Trang-'+i+'.jpg';images.push(blob);
  }
  return images;
 }catch(err){console.error('PDF error:',err);return null;}
}
const AUTH_KEY='ttks.sauBen.admin';let auth=sessionStorage.getItem(AUTH_KEY)||'',state=null,activeTab='stations',fetchBusy=false,lastReload=0;
const headers=()=>({'Authorization':'Bearer '+auth});
async function adminCall(path,data){return data===undefined?api(path,{headers:headers()}):post(path,data,headers())}
function loginView(){ $('loginScreen').classList.remove('hidden');$('dashboard').classList.add('hidden')}
function boardView(){$('loginScreen').classList.add('hidden');$('dashboard').classList.remove('hidden')}
async function loadBoard(){if(fetchBusy)return;fetchBusy=true;try{const s=await adminCall('/api/admin/state');state=s;boardView();renderBoard();$('serverStatus').textContent='● Đang kết nối trực tiếp'}catch(e){if(/Phiên quản trị|401|đăng nhập|hết hạn/.test(e.message)){sessionStorage.removeItem(AUTH_KEY);auth='';loginView()}$('serverStatus').textContent='● Chưa kết nối: '+e.message}finally{fetchBusy=false}}
function onLive(s){if(!auth||!state)return;let changed=s.updatedAt!==state.updatedAt;if(!changed)return;Object.assign(state,{activeStation:s.activeStation,phase:s.phase,unlocked:s.unlocked,stage:s.stage,questions:s.questions||state.questions,counts:s.counts,updatedAt:s.updatedAt});if(activeTab==='questions'&&!workingQuestions)renderQuestionsTab();renderBoard();const now=Date.now();if(now-lastReload>500){lastReload=now;loadBoard()}}
function renderBoard(){if(!state)return;const s=state,counts=s.counts||{};$('statPeople').textContent=counts.visitors||0;$('statComplete').textContent=counts.completed||0;$('statCurrent').textContent=s.activeStation?pad(s.activeStation)+' / 06':'—';$('statPhase').textContent=s.activeStation?(s.phase==='challenge'?'Đã mở':'Chưa mở'):'Chưa mở';
 $('adminStationGrid').innerHTML=DOCKS.map(d=>`<button class="station-admin-card ${s.activeStation===d.id?'live':''} ${s.unlocked.includes(d.id)?'past':''}" data-station="${d.id}"><span class="admin-emoji">${d.icon}</span><span><strong class="station-heading">${pad(d.id)} · ${safe(d.title)}</strong><small>Trang ${d.pages} · ${d.time}<br>${s.counts?.stamps?.[d.id-1]||0} người đã nhận dấu</small></span><span class="flag">${s.activeStation===d.id?(s.phase==='challenge'?'ĐANG MỞ':'ĐANG DIỄN'):s.unlocked.includes(d.id)?'ĐÃ GHÉ':''}</span></button>`).join('');
 const d=DOCKS.find(x=>x.id===s.activeStation);$('nowPlaying').textContent=d?`Đang ở bến ${d.id}: ${d.title} ${s.phase==='challenge'?'· Nhiệm vụ đã mở':'· Chưa bật nhiệm vụ'}`:'Chưa bắt đầu hành trình';$('activateButton').disabled=!d||s.phase==='challenge';$('activateButton').textContent=s.phase==='challenge'?'✓ Nhiệm vụ đã được mở':'Bật nhiệm vụ cho cả lớp ↗';
 const totalP=Number(localStorage.getItem('ttks.sauBen.totalSlides'))||(s.stage.totalSlides||46);
 $('slideRange').max=totalP;$('slideNumber').textContent=pad(s.stage.slide)+' / '+pad(totalP);$('slideRange').value=s.stage.slide;document.querySelectorAll('.projection-mode').forEach(btn=>btn.classList.toggle('current-mode',btn.dataset.mode===s.stage.mode&&(btn.dataset.mode!=='scene'||btn.dataset.scene===s.stage.scene)));
 renderPeople();
 updateMediaIndicators();
}
function renderPeople(){const rows=state?.people||[],q=$('peopleSearch').value.trim().toLocaleLowerCase('vi');const filtered=rows.filter(p=>p.name.toLocaleLowerCase('vi').includes(q));$('peopleRows').innerHTML=filtered.length?filtered.map((p,i)=>`<tr><td>${i+1}</td><td><strong>${safe(p.name)}</strong></td><td>${p.stamps.length} / 6</td><td><div class="tiny-progress"><span style="width:${p.stamps.length/6*100}%"></span></div></td><td class="${p.stamps.length===6?'status-complete':''}">${p.stamps.length===6?'✳ Đủ dấu':'Đang khám phá'}</td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;padding:30px;color:#999">Chưa có khán giả phù hợp</td></tr>'}
async function perform(path,data,success){try{await adminCall(path,data);if(success)toast(success);await loadBoard()}catch(e){toast(e.message)}}

let activeQuestionDock = 1;
let workingQuestions = null;

function syncDOMToWorkingQuestions() {
  if (!workingQuestions) {
    workingQuestions = JSON.parse(JSON.stringify(state?.questions || (typeof DEFAULT_QUESTIONS !== 'undefined' ? DEFAULT_QUESTIONS : {})));
  }
  const container = $('questionsEditorContainer');
  if (!container) return;
  const renderedDock = Number(container.dataset.renderedDock);
  if (!renderedDock || isNaN(renderedDock)) return;

  const cards = container.querySelectorAll('.q-card');
  if (!cards.length) return;

  workingQuestions[renderedDock] = workingQuestions[renderedDock] || [];
  const dockQs = workingQuestions[renderedDock];

  cards.forEach((card, qIndex) => {
    if (!dockQs[qIndex]) return;
    const promptInput = card.querySelector('.q-prompt-input');
    if (promptInput) {
      dockQs[qIndex].prompt = promptInput.value;
    }
    const optionRows = card.querySelectorAll('.q-option-row');
    optionRows.forEach((row, optIndex) => {
      if (!dockQs[qIndex].options || !dockQs[qIndex].options[optIndex]) return;
      const iconInput = row.querySelector('[data-field="icon"]');
      const textInput = row.querySelector('[data-field="text"]');
      const descInput = row.querySelector('[data-field="desc"]');
      const correctInput = row.querySelector('.q-correct-input');
      if (iconInput) dockQs[qIndex].options[optIndex].icon = iconInput.value;
      if (textInput) dockQs[qIndex].options[optIndex].text = textInput.value;
      if (descInput) dockQs[qIndex].options[optIndex].desc = descInput.value;
      if (correctInput) dockQs[qIndex].options[optIndex].isCorrect = correctInput.checked;
    });
  });
}

function renderQuestionsTab(doSync = false) {
  if (doSync) {
    syncDOMToWorkingQuestions();
  }
  if (!workingQuestions) {
    workingQuestions = JSON.parse(JSON.stringify(state?.questions || (typeof DEFAULT_QUESTIONS !== 'undefined' ? DEFAULT_QUESTIONS : {})));
  }
  const dockSel = $('questionDockSelector');
  if (dockSel) {
    dockSel.innerHTML = DOCKS.map(d => {
      const count = (workingQuestions[d.id] || []).length;
      return '<button type="button" class="q-dock-btn ' + (d.id === activeQuestionDock ? 'active' : '') + '" data-qdock="' + d.id + '">' +
        '<span>' + d.icon + '</span>' +
        '<strong>Bến ' + pad(d.id) + '</strong>' +
        '<span class="q-badge">' + count + ' câu</span>' +
      '</button>';
    }).join('');
  }
  renderQuestionsEditor();
}

function renderQuestionsEditor() {
  const container = $('questionsEditorContainer');
  if (!container) return;
  container.dataset.renderedDock = String(activeQuestionDock);
  const qs = workingQuestions[activeQuestionDock] || [];
  if (!qs.length) {
    container.innerHTML = '<div style="padding:30px;text-align:center;color:#888;background:#fff;border-radius:8px;">Bến này chưa có câu hỏi nào. Nhấn "+ Thêm câu hỏi cho bến này" để tạo câu hỏi đầu tiên.</div>';
    return;
  }
  container.innerHTML = qs.map((q, qIndex) => {
    const opts = q.options || [];
    const correctCount = opts.filter(o => o.isCorrect).length;
    const isMulti = q.isMulti !== undefined ? !!q.isMulti : correctCount >= 2;
    q.isMulti = isMulti;

    return '<div class="q-card" data-qcard="' + qIndex + '">' +
      '<div class="q-card-header">' +
        '<div class="q-card-title">' +
          '<span>❓</span>' +
          '<span>Câu hỏi ' + (qIndex + 1) + ' / ' + qs.length + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div class="q-type-toggle">' +
            '<label><input type="radio" name="mode_q_' + activeQuestionDock + '_' + qIndex + '" value="single" ' + (!isMulti ? 'checked' : '') + ' data-toggle-mode="' + qIndex + '"> 1 đáp án đúng</label>' +
            '<label><input type="radio" name="mode_q_' + activeQuestionDock + '_' + qIndex + '" value="multi" ' + (isMulti ? 'checked' : '') + ' data-toggle-mode="' + qIndex + '"> Nhiều đáp án</label>' +
          '</div>' +
          (qs.length > 1 ? '<button type="button" class="q-delete-card-btn" data-del-q="' + qIndex + '" title="Xóa câu hỏi này">✕ Xóa câu hỏi</button>' : '') +
        '</div>' +
      '</div>' +
      '<label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#244941;">NỘI DUNG CÂU HỎI (PROMPT)</label>' +
      '<textarea class="q-prompt-input" data-qprompt="' + qIndex + '" rows="2" placeholder="Nhập nội dung câu hỏi...">' + safe(q.prompt || '') + '</textarea>' +
      '<label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#244941;">CÁC PHƯƠNG ÁN LỰA CHỌN & ĐÁP ÁN ĐÚNG</label>' +
      '<div class="q-options-list">' +
        opts.map((opt, optIndex) => {
          const inputType = isMulti ? 'checkbox' : 'radio';
          const inputName = isMulti ? '' : 'name="correct_choice_' + activeQuestionDock + '_' + qIndex + '"';
          return '<div class="q-option-row" data-qindex="' + qIndex + '" data-optindex="' + optIndex + '">' +
            '<input type="text" class="q-opt-icon" data-field="icon" value="' + safe(opt.icon || '📌') + '" title="Biểu tượng Emoji">' +
            '<input type="text" class="q-opt-text" data-field="text" value="' + safe(opt.text || '') + '" placeholder="Tiêu đề phương án...">' +
            '<input type="text" class="q-opt-desc" data-field="desc" value="' + safe(opt.desc || '') + '" placeholder="Mô tả phụ (tùy chọn)...">' +
            '<label class="q-opt-correct ' + (opt.isCorrect ? 'is-chosen' : '') + '" title="Tích chọn nếu đây là đáp án đúng">' +
              '<input type="' + inputType + '" ' + inputName + ' class="q-correct-input" data-field="isCorrect" data-qindex="' + qIndex + '" data-optindex="' + optIndex + '" ' + (opt.isCorrect ? 'checked' : '') + '> ' +
              (isMulti ? 'Đúng' : 'Đáp án đúng') +
            '</label>' +
            (opts.length > 2 ? '<button type="button" class="q-opt-delete" data-del-opt="1" data-qindex="' + qIndex + '" data-optindex="' + optIndex + '" title="Xóa phương án">✕</button>' : '') +
          '</div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="q-add-opt-btn" data-add-opt="' + qIndex + '">+ Thêm phương án cho câu này</button>' +
    '</div>';
  }).join('');
}
function setTab(name){activeTab=name;document.querySelectorAll('.op-tabs button').forEach(el=>el.classList.toggle('tab-active',el.dataset.tab===name));document.querySelectorAll('.op-panel').forEach(el=>el.classList.add('hidden'));$('tab-'+name)?.classList.remove('hidden');if(name==='questions')renderQuestionsTab()}
function stageChange(mode,slide,scene){return perform('/api/admin/stage',{mode,slide:slide||state.stage.slide,scene:scene||state.stage.scene},`Sân khấu: ${mode==='book'?'trang '+(slide||state.stage.slide):mode==='scene'?'nền '+(SCENES[scene]?.title||scene):mode}`)}
async function resetSlotMedia(slot,btn){
 try{
  const db=await openDB();const tx=db.transaction('assets','readwrite');const store=tx.objectStore('assets');
  if(slot==='book'){
   store.delete('slides');localStorage.removeItem('ttks.sauBen.totalSlides');
   $('slideRange').max=46;$('slideNumber').textContent='01 / 46';
   let si=$('slidesInfo');if(si)si.textContent='Đã khôi phục slide mặc định (46 trang).';
  }else{
   store.delete(slot);
  }
  await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();
  delete localMediaMap[slot];
  if(btn)btn.classList.remove('has-media');
  updateMediaIndicators();
  if(window.location.protocol.startsWith('http')&&auth){
   try{await post('/api/admin/media/remove',{slot},headers())}catch{}
  }
  assetChannel?.postMessage({action:'removeMedia',slot});
  const title=btn?(btn.querySelector('strong')?.textContent||slot):slot;
  toast('Đã khôi phục giao diện mặc định cho ' + title);
 }catch(err){console.error('Lỗi khi xóa media:',err);toast('Không thể xóa dữ liệu');}
}
function setup(){
 $('toggleTools')?.addEventListener('click',()=>$('stageTools')?.classList.toggle('expanded'));
 $('stageFullscreen')?.addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});else document.exitFullscreen().catch(()=>{})});
 $('slideFiles')?.addEventListener('change',async e=>{
   let images=[...e.target.files].filter(f=>f.type.startsWith('image/')).sort((a,b)=>a.name.localeCompare(b.name,'vi',{numeric:true}));if(!images.length)return;
   toast('Đang tải ' + images.length + ' ảnh slide lên máy chủ...');
   await saveAssets('images',images);localMediaMap['book']={type:'book',format:'images',name:images.length+' ảnh'};
   localStorage.setItem('ttks.sauBen.totalSlides',images.length);assetChannel?.postMessage({action:'reload',totalPages:images.length});
   const srvRes=await uploadMediaToServer('book',images,{totalPages:images.length});
   if(srvRes&&srvRes.media)localMediaMap['book']=srvRes.media;
   await stageChange('book',1,'song');let si=$('slidesInfo');if(si)si.textContent='Đã nạp ' + images.length + ' ảnh slide.';
   updateMediaIndicators();toast('Đã nạp và đồng bộ ' + images.length + ' ảnh slide cho sân khấu');
 });
 $('pdfFile')?.addEventListener('change',async e=>{
   const f=e.target.files?.[0];if(!f)return;
   toast('Đang xử lý các trang PDF (tối đa 46 trang)...');
   const images=await convertPdfToSlideImages(f,46);
   let total=46;
   if(images&&images.length){
     total=images.length;await saveAssets('images',images);
     localMediaMap['book']={type:'book',format:'images',name:total+' trang'};
     localStorage.setItem('ttks.sauBen.totalSlides',total);
     assetChannel?.postMessage({action:'reload',totalPages:total});
     toast('Đang tải ' + total + ' trang PDF lên máy chủ...');
     const srvRes=await uploadMediaToServer('book',images,{totalPages:total});
     if(srvRes&&srvRes.media)localMediaMap['book']=srvRes.media;
   }else{
     await saveAssets('pdf',[f]);localMediaMap['book']={type:'pdf',name:f.name};
     assetChannel?.postMessage({action:'reload',totalPages:46});
     toast('Đang tải file PDF lên máy chủ...');
     const srvRes=await uploadMediaToServer('book',[f],{totalPages:46});
     if(srvRes&&srvRes.media)localMediaMap['book']=srvRes.media;
   }
   $('slideRange').max=total;$('slideNumber').textContent='01 / '+pad(total);
   await stageChange('book',1,'song');let si=$('slidesInfo');if(si)si.textContent='Đã nạp PDF: '+f.name+' ('+total+' trang)';
   updateMediaIndicators();toast('Đã nạp và đồng bộ ' + total + ' trang PDF cho sân khấu');
 });
 $('videoFile')?.addEventListener('change',async e=>{
   const f=e.target.files?.[0];if(!f)return;
   toast('Đang tải video ' + f.name + ' lên máy chủ... Vui lòng đợi!');
   await saveSlotMedia('video','video',f);localMediaMap['video']={type:'video',name:f.name,url:URL.createObjectURL(f)};
   assetChannel?.postMessage({action:'slotMedia',slot:'video'});
   const srvRes=await uploadMediaToServer('video',f);
   if(srvRes&&srvRes.media)localMediaMap['video']=srvRes.media;
   await stageChange('video',state?.stage?.slide||1,state?.stage?.scene||'song');
   updateMediaIndicators();toast('Đã nạp và đồng bộ video: '+f.name);
 });
 let localAudioUrl=null;
 $('audioFile')?.addEventListener('change',e=>{
   const f=e.target.files?.[0];if(!f)return;if(localAudioUrl)URL.revokeObjectURL(localAudioUrl);localAudioUrl=URL.createObjectURL(f);let sa=$('stageAudio');if(sa){sa.src=localAudioUrl;sa.play().catch(()=>{})}toast('Đã nạp nhạc '+f.name);
 });
 $('stagePrev')?.addEventListener('click',()=>stageChange('book',Math.max(1,state.stage.slide-1)));
 $('stageNext')?.addEventListener('click',()=>stageChange('book',Math.min(46,state.stage.slide+1)));
 $('stageWelcome')?.addEventListener('click',()=>stageChange('welcome',1,'song'));
 $('stageToggleHint')?.addEventListener('click',()=>{toast('Đã gửi lệnh đổi hiển thị bến');assetChannel?.postMessage({action:'toggleHint'})});
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';try{const r=await post('/api/admin/login',{pin:$('pin').value});auth=r.token;sessionStorage.setItem(AUTH_KEY,auth);$('pin').value='';await loadBoard()}catch(err){$('loginError').textContent=err.message}});
 $('signoutBtn').addEventListener('click',()=>{auth='';sessionStorage.removeItem(AUTH_KEY);loginView()});
 document.querySelectorAll('.op-tabs button').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
 $('adminStationGrid').addEventListener('click',e=>{const btn=e.target.closest('[data-station]');if(!btn)return;const n=Number(btn.dataset.station);if(state.activeStation===n){toast('Bến này đang được chọn');return}perform('/api/admin/open',{station:n},`Đã cập bến ${n}. Nhiệm vụ vẫn đang chờ mở.`)});
 $('activateButton').addEventListener('click',()=>perform('/api/admin/activate',{},'Nhiệm vụ đã hiện trên điện thoại khán giả!'));
 loadSlotMediaMap();
 async function uploadMediaToServer(slot,files,extra={}){
  if(!window.location.protocol.startsWith('http')||!auth)return null;
  const fd=new FormData();fd.append('slot',slot);
  if(extra.totalPages)fd.append('totalPages',extra.totalPages);
  if(Array.isArray(files)){files.forEach(f=>fd.append('files',f))}
  else if(files){fd.append('files',files)}
  try{
   const res=await fetch('/api/admin/media/upload',{method:'POST',headers:{'Authorization':'Bearer '+auth},body:fd});
   if(!res.ok){
    const err=await res.json().catch(()=>({}));
    throw new Error(err.error||('Lỗi máy chủ ('+res.status+')'));
   }
   return await res.json();
  }catch(err){
   console.error('Lỗi tải media lên máy chủ:',err);
   toast('⚠️ Lỗi gửi lên máy chủ: '+err.message);
   return null;
  }
 }
 let modeClickTimer=null;
 function handleCardUpload(btn,slot){
  const input=document.createElement('input');input.type='file';input.style.display='none';document.body.appendChild(input);
  if(slot==='book'){input.accept='.pdf,.pptx,image/*';input.multiple=true}
  else if(slot==='video'||slot==='scene_cuchi'){input.accept='video/*'}
  else{input.accept='image/*'}
  input.addEventListener('change',async e=>{
   const files=[...e.target.files];input.remove();if(!files.length)return;
   if(slot==='book'){
    const isPptx=files.some(f=>f.name.toLowerCase().endsWith('.pptx'));
    if(isPptx){toast('⚠️ PPTX cần xuất sang PDF hoặc ảnh PNG để máy chiếu lật trang mượt mà.');return}
    const pdf=files.find(f=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'));
    if(pdf){
     toast('Đang xử lý các trang PDF (tối đa 46 trang)...');
     const images=await convertPdfToSlideImages(pdf,46);
     let total=46;
     if(images&&images.length){
      total=images.length;await saveAssets('images',images);
      localMediaMap['book']={type:'book',format:'images',name:total+' trang'};
      localStorage.setItem('ttks.sauBen.totalSlides',total);
      assetChannel?.postMessage({action:'reload',totalPages:total});
      toast('Đang tải ' + total + ' trang PDF lên máy chủ...');
      const srvRes=await uploadMediaToServer('book',images,{totalPages:total});
      if(srvRes&&srvRes.media)localMediaMap['book']=srvRes.media;
     }else{
      await saveAssets('pdf',[pdf]);localMediaMap['book']={type:'pdf',name:pdf.name};
      assetChannel?.postMessage({action:'reload',totalPages:46});
      toast('Đang tải file PDF lên máy chủ...');
      const srvRes=await uploadMediaToServer('book',[pdf],{totalPages:46});
      if(srvRes&&srvRes.media)localMediaMap['book']=srvRes.media;
     }
     $('slideRange').max=total;$('slideNumber').textContent='01 / '+pad(total);
     updateMediaIndicators();toast('Đã nạp và đồng bộ ' + total + ' trang PDF cho Flipbook');return
    }
    const images=files.filter(f=>f.type.startsWith('image/')).sort((a,b)=>a.name.localeCompare(b.name,'vi',{numeric:true}));
    if(images.length){
     await saveAssets('images',images);localMediaMap['book']={type:'book',format:'images',name:images.length+' ảnh'};
     localStorage.setItem('ttks.sauBen.totalSlides',images.length);
     assetChannel?.postMessage({action:'reload',totalPages:images.length});
     toast('Đang tải ' + images.length + ' trang ảnh lên máy chủ...');
     const srvRes=await uploadMediaToServer('book',images,{totalPages:images.length});
     if(srvRes&&srvRes.media)localMediaMap['book']=srvRes.media;
     $('slideRange').max=images.length;$('slideNumber').textContent='01 / '+pad(images.length);
     updateMediaIndicators();toast('Đã nạp và đồng bộ ' + images.length + ' trang ảnh cho Flipbook');return
    }
   }else if(slot==='video'||slot==='scene_cuchi'){
    const f=files[0];if(!f)return;
    toast('Đang tải video ' + f.name + ' lên máy chủ... Vui lòng đợi!');
    await saveSlotMedia(slot,'video',f);localMediaMap[slot]={type:'video',name:f.name,url:URL.createObjectURL(f)};
    assetChannel?.postMessage({action:'slotMedia',slot});
    const srvRes=await uploadMediaToServer(slot,f);
    if(srvRes&&srvRes.media)localMediaMap[slot]=srvRes.media;
    updateMediaIndicators();toast('Đã nạp và đồng bộ video ' + f.name + ' cho ' + (btn.querySelector('strong')?.textContent||slot));
   }else{
    const f=files[0];if(!f)return;
    toast('Đang tải ảnh nền ' + f.name + ' lên máy chủ...');
    await saveSlotMedia(slot,'image',f);localMediaMap[slot]={type:'image',name:f.name,url:URL.createObjectURL(f)};
    assetChannel?.postMessage({action:'slotMedia',slot});
    const srvRes=await uploadMediaToServer(slot,f);
    if(srvRes&&srvRes.media)localMediaMap[slot]=srvRes.media;
    updateMediaIndicators();toast('Đã nạp và đồng bộ ảnh nền ' + f.name + ' cho ' + (btn.querySelector('strong')?.textContent||slot));
   }
  });
  input.click();
 }
 document.querySelectorAll('.projection-mode').forEach(btn=>{
  btn.addEventListener('click',e=>{
   if(e.target.closest('.card-gear'))return;
   clearTimeout(modeClickTimer);
   modeClickTimer=setTimeout(()=>{
    stageChange(btn.dataset.mode,null,btn.dataset.scene||state.stage.scene);
   },250);
  });
  btn.addEventListener('dblclick',e=>{
   if(e.target.closest('.card-gear'))return;
   e.preventDefault();
   clearTimeout(modeClickTimer);
   const slot=getCardSlot(btn);
   if(!slot){toast('Ô này sử dụng đồ họa mặc định');return}
   handleCardUpload(btn,slot);
  });
  const gear=btn.querySelector('.card-gear');
  if(gear){
   gear.addEventListener('click',async e=>{
    e.stopPropagation();e.preventDefault();clearTimeout(modeClickTimer);
    const slot=getCardSlot(btn);if(!slot)return;
    const title=btn.querySelector('strong')?.textContent||'ô này';
    if(!confirm('Bạn có chắc muốn xóa dữ liệu đã tải lên và khôi phục giao diện mặc định cho ' + title + '?'))return;
    await resetSlotMedia(slot,btn);
   });
  }
 });
 $('prevSlide').addEventListener('click',()=>stageChange('book',Math.max(1,state.stage.slide-1)));
 $('nextSlide').addEventListener('click',()=>{const maxP=Number($('slideRange')?.max)||46;stageChange('book',Math.min(maxP,state.stage.slide+1))});
 $('slideRange').addEventListener('change',e=>stageChange('book',Number(e.target.value)));
 $('peopleSearch').addEventListener('input',renderPeople);
 $('exportCSV').addEventListener('click',async()=>{const r=await fetch('/api/admin/export',{headers:headers()});if(!r.ok){toast('Không xuất được danh sách');return}const blob=await r.blob(),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='danh-sach-sau-ben.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)});
 $('resetAll').addEventListener('click',async()=>{if(!confirm('Thao tác này XÓA vĩnh viễn toàn bộ dấu và người tham gia trong buổi diễn. Bạn chắc chắn muốn bắt đầu lại?'))return;const typed=prompt('Để xác nhận, gõ: XOA TAT CA');if(typed==='XOA TAT CA')perform('/api/admin/reset',{confirm:typed},'Đã đưa hành trình về trạng thái ban đầu')});
 const defaultUrl=(window.location.protocol.startsWith('http')?(window.location.origin+'/'):'https://website-thuc-te-chua-trien-khai/');const stored=localStorage.getItem('ttks.sauBen.audienceUrl')||defaultUrl;$('audienceUrl').value=stored;setQR(stored);
 $('updateQR').addEventListener('click',()=>{let url=$('audienceUrl').value.trim();try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw Error();url=u.href;localStorage.setItem('ttks.sauBen.audienceUrl',url);setQR(url);toast('QR đã cập nhật. Mở /stage và tải lại nếu đang chiếu QR.') }catch{toast('Cần nhập đường dẫn bắt đầu bằng https:// hoặc http://')}});
 $('copyURL').addEventListener('click',async()=>{const link=$('audienceUrl').value.trim();try{await navigator.clipboard.writeText(link);toast('Đã sao chép đường dẫn')}catch{prompt('Sao chép đường dẫn:',link)}});
 if(auth)loadBoard();else loginView();
 listenUpdates(onLive,online=>{if(auth)$('serverStatus').textContent=online?'● Đồng bộ trực tiếp':'● Kết nối tạm gián đoạn'});
 setInterval(()=>{if(auth&&document.visibilityState!=='hidden')loadBoard()},4500);
}
function setQR(u){$('adminQrImage').src=window.__DEMO_QR__||'/api/qr.svg?url='+encodeURIComponent(u)}

 $('questionDockSelector')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-qdock]');
    if (!btn) return;
    const targetDock = Number(btn.dataset.qdock);
    if (targetDock === activeQuestionDock) return;

    // 1. Sync current DOM inputs into workingQuestions
    syncDOMToWorkingQuestions();

    // 2. Check if there are unsaved changes in current dock
    const savedQs = (state?.questions && (state.questions[activeQuestionDock] || state.questions[String(activeQuestionDock)])) 
                    || (typeof DEFAULT_QUESTIONS !== 'undefined' ? DEFAULT_QUESTIONS[activeQuestionDock] : []);
    const currentQs = workingQuestions[activeQuestionDock] || [];
    const hasUnsaved = JSON.stringify(savedQs) !== JSON.stringify(currentQs);

    if (hasUnsaved) {
      const wantSave = confirm('Bạn có thay đổi chưa lưu ở Bến ' + activeQuestionDock + '. Bạn có muốn lưu thay đổi trước khi chuyển bến không?');
      if (wantSave) {
        for (let i = 0; i < currentQs.length; i++) {
          const q = currentQs[i];
          if (!q.prompt || !q.prompt.trim()) {
            toast('⚠️ Câu ' + (i + 1) + ' chưa có nội dung câu hỏi! Vui lòng hoàn thiện trước khi chuyển bến.');
            return;
          }
          const hasCorrect = (q.options || []).some(o => o.isCorrect);
          if (!hasCorrect) {
            toast('⚠️ Vui lòng chọn ít nhất 1 đáp án đúng cho Câu ' + (i + 1) + '! Vui lòng hoàn thiện trước khi chuyển bến.');
            return;
          }
        }
        try {
          const res = await adminCall('/api/admin/questions', { station: activeQuestionDock, questions: currentQs });
          if (res && res.questions) {
            state.questions = res.questions;
            workingQuestions = JSON.parse(JSON.stringify(res.questions));
          }
          toast('Đã lưu thành công bộ câu hỏi cho Bến ' + activeQuestionDock + '!');
        } catch (err) {
          toast('⚠️ Lỗi khi lưu: ' + err.message);
          return;
        }
      } else {
        workingQuestions[activeQuestionDock] = JSON.parse(JSON.stringify(savedQs));
      }
    }

    activeQuestionDock = targetDock;
    renderQuestionsTab(false);
  });

  $('questionsEditorContainer')?.addEventListener('input', e => {
    if (!workingQuestions) return;
    const qprompt = e.target.dataset.qprompt;
    if (qprompt !== undefined) {
      const qIndex = Number(qprompt);
      if (workingQuestions[activeQuestionDock] && workingQuestions[activeQuestionDock][qIndex]) {
        workingQuestions[activeQuestionDock][qIndex].prompt = e.target.value;
      }
      return;
    }
    const field = e.target.dataset.field;
    if (field && field !== 'isCorrect') {
      const row = e.target.closest('[data-qindex]');
      const qIndex = Number(row?.dataset.qindex);
      const optIndex = Number(row?.dataset.optindex);
      if (!isNaN(qIndex) && !isNaN(optIndex) && workingQuestions[activeQuestionDock]?.[qIndex]?.options?.[optIndex]) {
        workingQuestions[activeQuestionDock][qIndex].options[optIndex][field] = e.target.value;
      }
    }
  });

  $('questionsEditorContainer')?.addEventListener('change', e => {
    if (!workingQuestions) return;
    const target = e.target;
    
    // Mode switch: single vs multi
    if (target.dataset.toggleMode !== undefined) {
      syncDOMToWorkingQuestions();
      const qIndex = Number(target.dataset.toggleMode);
      const isMulti = target.value === 'multi';
      const q = workingQuestions[activeQuestionDock]?.[qIndex];
      if (q) {
        q.isMulti = isMulti;
        if (!isMulti) {
          let keptOne = false;
          (q.options || []).forEach(o => {
            if (o.isCorrect && !keptOne) keptOne = true;
            else o.isCorrect = false;
          });
          if (!keptOne && q.options && q.options.length) q.options[0].isCorrect = true;
        }
        renderQuestionsEditor();
      }
      return;
    }

    // Correct answer selection
    if (target.classList.contains('q-correct-input')) {
      const qIndex = Number(target.dataset.qindex);
      const optIndex = Number(target.dataset.optindex);
      const q = workingQuestions[activeQuestionDock]?.[qIndex];
      if (!q || !q.options || !q.options[optIndex]) return;

      if (target.type === 'radio') {
        q.options.forEach((o, idx) => {
          o.isCorrect = (idx === optIndex);
        });
      } else {
        q.options[optIndex].isCorrect = target.checked;
      }
      const card = target.closest('.q-card');
      if (card) {
        card.querySelectorAll('.q-option-row').forEach((row, idx) => {
          const lbl = row.querySelector('.q-opt-correct');
          const isChecked = q.options[idx]?.isCorrect;
          if (lbl) lbl.classList.toggle('is-chosen', !!isChecked);
        });
      }
    }
  });

  $('questionsEditorContainer')?.addEventListener('click', e => {
    if (!workingQuestions) return;
    const delOpt = e.target.closest('[data-del-opt]');
    if (delOpt) {
      syncDOMToWorkingQuestions();
      const qIndex = Number(delOpt.dataset.qindex);
      const optIndex = Number(delOpt.dataset.optindex);
      if (!isNaN(qIndex) && !isNaN(optIndex)) {
        const opts = workingQuestions[activeQuestionDock][qIndex].options;
        if (opts.length <= 2) {
          toast('⚠️ Mỗi câu hỏi cần có tối thiểu 2 phương án lựa chọn!');
          return;
        }
        opts.splice(optIndex, 1);
        renderQuestionsEditor();
      }
      return;
    }

    const addOpt = e.target.closest('[data-add-opt]');
    if (addOpt) {
      syncDOMToWorkingQuestions();
      const qIndex = Number(addOpt.dataset.addOpt);
      if (!isNaN(qIndex)) {
        const newId = 'opt_' + Date.now();
        workingQuestions[activeQuestionDock][qIndex].options.push({
          id: newId,
          icon: '📌',
          text: 'Phương án mới',
          desc: '',
          isCorrect: false
        });
        renderQuestionsEditor();
      }
      return;
    }

    const delQ = e.target.closest('[data-del-q]');
    if (delQ) {
      syncDOMToWorkingQuestions();
      const qIndex = Number(delQ.dataset.delQ);
      if (!isNaN(qIndex)) {
        if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
          workingQuestions[activeQuestionDock].splice(qIndex, 1);
          renderQuestionsTab(false);
        }
      }
      return;
    }
  });

  $('addQuestionBtn')?.addEventListener('click', () => {
    syncDOMToWorkingQuestions();
    if (!workingQuestions) workingQuestions = JSON.parse(JSON.stringify(state?.questions || (typeof DEFAULT_QUESTIONS !== 'undefined' ? DEFAULT_QUESTIONS : {})));
    workingQuestions[activeQuestionDock] = workingQuestions[activeQuestionDock] || [];
    const dockQs = workingQuestions[activeQuestionDock];
    const newQId = 'q_' + Date.now();
    dockQs.push({
      id: newQId,
      prompt: 'Nội dung câu hỏi ' + (dockQs.length + 1) + ' cho Bến ' + activeQuestionDock,
      isMulti: false,
      options: [
        { id: 'opt_1_' + Date.now(), icon: 'A', text: 'Phương án A', desc: '', isCorrect: true },
        { id: 'opt_2_' + Date.now(), icon: 'B', text: 'Phương án B', desc: '', isCorrect: false }
      ]
    });
    renderQuestionsTab(false);
    toast('Đã thêm 1 câu hỏi mới cho Bến ' + activeQuestionDock);
  });

  async function saveQuestionsAction() {
    syncDOMToWorkingQuestions();
    if (!workingQuestions) return;
    const qs = workingQuestions[activeQuestionDock] || [];
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!q.prompt || !q.prompt.trim()) {
        toast('⚠️ Câu ' + (i + 1) + ' chưa có nội dung câu hỏi!');
        return;
      }
      const hasCorrect = (q.options || []).some(o => o.isCorrect);
      if (!hasCorrect) {
        toast('⚠️ Vui lòng chọn ít nhất 1 đáp án đúng cho Câu ' + (i + 1) + '!');
        return;
      }
    }
    try {
      const res = await adminCall('/api/admin/questions', { station: activeQuestionDock, questions: qs });
      if (res && res.questions) {
        state.questions = res.questions;
        workingQuestions = JSON.parse(JSON.stringify(res.questions));
      }
      toast('Đã lưu thành công bộ câu hỏi cho Bến ' + activeQuestionDock + '!');
      renderQuestionsTab(false);
    } catch (err) {
      toast('⚠️ Lỗi khi lưu: ' + err.message);
    }
  }

  $('saveQuestionsBtn')?.addEventListener('click', saveQuestionsAction);
  $('saveQuestionsBottomBtn')?.addEventListener('click', saveQuestionsAction);

  async function resetCurrentDockQuestions() {
    if (!confirm('Khôi phục toàn bộ câu hỏi của Bến ' + activeQuestionDock + ' về mặc định ban đầu?')) return;
    try {
      const res = await adminCall('/api/admin/questions/reset', { station: activeQuestionDock });
      if (res && res.questions) {
        state.questions = res.questions;
        workingQuestions = JSON.parse(JSON.stringify(res.questions));
      } else if (typeof DEFAULT_QUESTIONS !== 'undefined' && DEFAULT_QUESTIONS[activeQuestionDock]) {
        workingQuestions[activeQuestionDock] = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS[activeQuestionDock]));
      }
      toast('Đã khôi phục câu hỏi mặc định cho Bến ' + activeQuestionDock + '!');
      renderQuestionsTab(false);
    } catch (err) {
      toast('⚠️ Lỗi khi khôi phục: ' + err.message);
    }
  }

  async function resetAllDocksQuestions() {
    if (!confirm('Khôi phục toàn bộ câu hỏi của TẤT CẢ 6 BẾN về mặc định ban đầu? Thao tác này sẽ xóa mọi chỉnh sửa trên cả 6 bến.')) return;
    try {
      const res = await adminCall('/api/admin/questions/reset', { station: 'all' });
      if (res && res.questions) {
        state.questions = res.questions;
        workingQuestions = JSON.parse(JSON.stringify(res.questions));
      } else if (typeof DEFAULT_QUESTIONS !== 'undefined') {
        workingQuestions = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
      }
      toast('Đã khôi phục toàn bộ câu hỏi của cả 6 bến về mặc định ban đầu!');
      renderQuestionsTab(false);
    } catch (err) {
      toast('⚠️ Lỗi khi khôi phục: ' + err.message);
    }
  }

  $('resetQuestionsBtn')?.addEventListener('click', resetCurrentDockQuestions);
  $('resetQuestionsBottomBtn')?.addEventListener('click', resetCurrentDockQuestions);
  $('resetAllQuestionsBtn')?.addEventListener('click', resetAllDocksQuestions);
  $('resetAllQuestionsBottomBtn')?.addEventListener('click', resetAllDocksQuestions);
setup();
