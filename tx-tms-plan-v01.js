/* plan_v01 Phase 1: local prototype adapters. Production requires authenticated APIs. */
const STORE_KEY = 'tx-tms-plan-v01-2', TAB_KEY = 'tx-tms-tabs-v01', SESSION_KEY = 'tx-tms-session-v01';
let storeError = '', session = null;
const bodyText = (r,f) => r.type === 'RCS' ? (f.cards || []).map(x=>x.body || '').join('\n') : f.body || f.text || '';
const varsFor = r => isFinal(r) ? r.bundle?.variables || [] : S.vars.filter(v=>v.pid===r.pid);
const resolveText = (r,text) => String(text || '').replace(/#\{([^}]+)\}/g,(m,k)=>varsFor(r).find(v=>v.key===k)?.ex ?? m);
function persist() {
  if(S.sim.saveFail) throw new Error('저장 실패 상황');
  localStorage.setItem(STORE_KEY,JSON.stringify({...S,me:null})); storeError='';
  if(S.me) localStorage.setItem(TAB_KEY+':'+S.me,JSON.stringify(UI.tabs.map(t=>({route:t.route,p:t.p}))));
}
function persistSafe(){try{persist();return true;}catch(e){storeError='브라우저에 저장하지 못했습니다. 수동 저장을 다시 실행하세요.';return false;}}
function restoreStore(){
  try{const data=localStorage.getItem(STORE_KEY);if(data){S=JSON.parse(data);S.me=null;}}catch(e){storeError='저장 데이터를 읽지 못했습니다';}
  S.outbox ||= [];S.invitations ||= [];S.resets ||= [];
  const keys={'고객명':'customer_name','적립포인트':'points','이벤트기간':'event_period','청구금액':'billing_amount','결제일':'payment_day','카드명':'card_name','기준일':'reference_date','납입일':'due_date','보험료':'premium'};
  // Migrate legacy seed variable references and names together.
  for(const [old,key] of Object.entries(keys)){S.vars.filter(v=>v.key===old).forEach(v=>v.key=key);S.requests.forEach(r=>{const remap=f=>JSON.parse(JSON.stringify(f).split('#{'+old+'}').join('#{'+key+'}'));r.contents.forEach(c=>{c.f=remap(c.f);c.versions.forEach(v=>v.f=remap(v.f));});r.bundle?.items.forEach(i=>i.f=remap(i.f));});}
  S.vars.forEach(v=>v.type ||= 'text');
  S.requests.forEach(r=>{r.contents.forEach(c=>{if(c.lockBy&&!c.lockAt)c.lockAt=Date.now();});if(r.bundle&&!r.bundle.variables)r.bundle.variables=clone(S.vars.filter(v=>v.pid===r.pid));});
}
const baseRender=render;
render=function(){
  baseRender();const main=$('#main');
  if(main){main.querySelectorAll('.flag,[data-a="pub"],[data-a="fpReport"],[data-a="grant"],[data-a="revoke"]').forEach(el=>el.remove());main.querySelectorAll('.panel').forEach(el=>{if(['보관 공개 범위','내 콘텐츠 접근 범위','운영 지원 접근 현황','내 지원 접근'].includes(el.querySelector('h3')?.textContent))el.remove();});if(storeError)main.insertAdjacentHTML('afterbegin',`<div class="banner danger" role="alert">${esc(storeError)}</div>`);}
  if(S.me&&!UI.tabs.some(t=>t.dirty))persistSafe();
};
const baseOpenTab=openTab;
openTab=function(route,p={},opt={}){
  const exists=UI.tabs.some(t=>t.route===route&&(!['request','content'].includes(route)||t.p.id===p.id&&(route!=='content'||t.p.cid===p.cid)));
  if(UI.tabs.length>=10&&!exists){toast('업무 탭은 최대 10개입니다. 기존 탭을 닫아 주세요.');return activeTab();}
  return baseOpenTab(route,p,opt);
};
const baseCanView=canView;
canView=function(r){return !!(r&&P(r.pid)&&me().active&&Cu(P(r.pid).cid)?.active!==false&&baseCanView(r));};
can.due=r=>canView(r)&&!isFinal(r)&&r.status!=='draft'&&(r.status==='appr'?can.approve(r):isAdmin(P(r.pid).cid)||P(r.pid).lead===S.me||hasRole(r.pid,'approver'));
canEditContent=function(r){return canView(r)&&(r.status==='draft'&&r.by===S.me||r.status==='ask'&&r.by===S.me||r.status==='review'&&r.reviewers.includes(S.me));};
function expireLocks(time=Date.now()){S.requests.forEach(r=>r.contents.forEach(c=>{if(c.lockBy&&time-(c.lockAt||time)>=30*60000){const owner=c.lockBy;c.lockBy=null;c.lockAt=null;log(r,'편집 잠금 자동 해제',`${U(owner).name}: 30분간 입력 없음`,c.id);}}));}
const baseMutF=mutF;
mutF=function(tab,r,c){expireLocks();const result=baseMutF(tab,r,c);if(!result.auto)c.lockAt=Date.now();return result;};
autosave=function(tab,c,immediate){
  tab.st.save='saving';tab.dirty=true;clearTimeout(tab._t);
  const attempt=n=>{if(!UI.tabs.includes(tab))return;try{persist();tab.st.save='saved';tab.dirty=false;if(c)c.savedAt=now();}catch(e){if(n<3){tab._t=setTimeout(()=>attempt(n+1),1000);}else{tab.st.save='fail';storeError='저장 실패: 3회 재시도했습니다. 수동 저장을 실행하세요.';}}if(UI.active===tab.id)updateLive(tab,Rq(tab.p.id),c);else renderTabsOnly();};
  tab._t=setTimeout(()=>attempt(0),immediate?0:700);updateLive(tab,Rq(tab.p.id),c);
};
setInterval(()=>UI.tabs.filter(t=>t.dirty&&Rq(t.p.id)?.status==='draft').forEach(t=>autosave(t,null,true)),30000);
window.addEventListener('beforeunload',e=>{if(UI.tabs.some(t=>t.dirty)){e.preventDefault();e.returnValue='';}});
const baseValidate=validateReq;
function validLink(value,r){try{return ['http:','https:'].includes(new URL(resolveText(r,value)).protocol);}catch(e){return false;}}
validateReq=function(r){
  const out=baseValidate(r),p=P(r.pid),push=msg=>out.list.push(msg);let count=0,size=0;
  if(!p.active)push('사용 중인 프로젝트에서 검수를 요청하세요');
  r.contents.forEach(c=>{const f=c.f,label=c.id;
    if(r.type==='알림톡'){if(!p.tpls.some(t=>t.code===f.tpl))push(`${label}: 등록된 승인 템플릿`);if((f.body||'').length>1000)push(`${label}: 본문 최대 1,000자`);if(f.btns.length>5)push(`${label}: 버튼 최대 5개`);f.btns.forEach(b=>{if(b.n.length>14)push(`${label}: 버튼명 최대 14자`);if(!validLink(b.l,r))push(`${label}: HTTP/HTTPS 버튼 링크`);});}
    if(r.type==='문자'){if(!p.senders.includes(f.sender))push(`${label}: 등록된 발신번호`);if(bytes(f.body)+(f.optout?24:0)+(f.cs?22:0)>2000)push(`${label}: LMS 최대 2,000바이트 (안내 포함)`);}
    if(r.type==='RCS'){if(!f.cards?.length)push(`${label}: 카드 1개 이상`);(f.cards||[]).forEach((card,i)=>{if(!card.title?.trim())push(`${label}: 카드 ${i+1} 제목`);if(!!card.bn!==!!card.bl||card.bl&&!validLink(card.bl,r))push(`${label}: 카드 ${i+1} 버튼명과 HTTP/HTTPS 링크`);});}
    for(const [,key] of JSON.stringify(f).matchAll(/#\{([^}]+)\}/g))if(!S.vars.some(v=>v.pid===r.pid&&v.active&&!v.deleted&&v.key===key))push(`${label}: 등록되지 않았거나 비활성 변수 ${key}`);
    c.files.forEach(fl=>{count++;size+=fl.size||0;if(!Number.isInteger(+fl.total)||!Number.isInteger(+fl.rangeN)||+fl.rangeN<1||+fl.rangeN>+fl.total)push(`${label}: ${fl.name} 검수 범위는 전체 분량 이내의 양의 정수`);});
  });if(count>10||size>100*1024*1024)push('요청당 첨부 최대 10개, 총 100MB');return out;
};
const baseRunCheck=runCheck;
runCheck=function(r,c,f){f ||= c.f;const result=baseRunCheck(r,c,f);effectiveRules(r.type,P(r.pid).cid).rules.filter(rule=>rule.mode==='regex').forEach(rule=>{result.issues=result.issues.filter(x=>x.from!==rule.p);for(const [key,value] of textFields(r.type,f))for(const m of String(value||'').matchAll(new RegExp(rule.p,'gu'))){if(m[0])result.issues.push({key,start:m.index,end:m.index+m[0].length,from:m[0],to:m[0].replace(new RegExp(rule.p,'u'),rule.s),reason:rule.r,src:rule.src});}});return result;};
const baseMock=mockHTML;
mockHTML=function(r,f,c){const replace=v=>typeof v==='string'?resolveText(r,v):Array.isArray(v)?v.map(replace):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,replace(x)])):v;return baseMock(r,replace(f),c);};
function varUsed(v){return S.requests.some(r=>r.pid===v.pid&&r.contents.some(c=>JSON.stringify(c.f).includes(`#{${v.key}}`)));}
function checkVariable(pid,key,type,value,except){
  if(!/^[a-z0-9_]+$/.test(key))return '변수 키는 영문 소문자, 숫자, 밑줄만 사용하세요';
  if(S.vars.some(v=>v.pid===pid&&v.id!==except&&v.key.toLowerCase()===key.toLowerCase()))return '프로젝트 내 중복 변수 키입니다';
  if(type==='number'&&(!String(value).trim()||!Number.isFinite(Number(value))))return '정수 또는 소수를 입력하세요';
  if(type==='date'){const d=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||isNaN(d)||d.toISOString().slice(0,10)!==value)return '유효한 YYYY-MM-DD 날짜를 입력하세요';}
  if(type==='link'){try{if(!['http:','https:'].includes(new URL(value).protocol))return 'HTTP/HTTPS 링크를 입력하세요';}catch(e){return '유효한 링크를 입력하세요';}}
  return '';
}
vVars=function(tab){const ps=S.projects.filter(p=>p.cid===S.cid),pid=ps.some(p=>p.id===tab.st.pid)?tab.st.pid:S.pid;return `<div class="page wide"><div class="ph"><div><h1>변수 관리</h1><p>진행 중 문안에는 현재 값, 완료 묶음에는 완료 당시 값을 적용합니다.</p></div><div class="acts"><select class="sel" data-i="varProj">${ps.map(p=>`<option value="${p.id}" ${pid===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button class="btn pri" data-a="varNew" data-pid="${pid}">변수 등록</button></div></div><div class="panel tbl-wrap"><table class="tbl"><thead><tr><th>키</th><th>설명</th><th>자료형</th><th>값</th><th>사용</th><th>이력</th><th></th></tr></thead><tbody>${S.vars.filter(v=>v.pid===pid).map(v=>`<tr><td>${esc(v.key)}</td><td>${esc(v.desc)}</td><td>${esc(v.type)}</td><td>${esc(v.ex)}</td><td>${v.deleted?'삭제':v.active?'활성':'중지'}${varUsed(v)?' · 사용 중':''}</td><td>${v.log.map(l=>`${fDT(l.at)} ${esc(l.act)}`).join('<br>')}</td><td><button class="btn sm" data-a="varEdit" data-id="${v.id}" ${v.deleted?'disabled':''}>편집</button><button class="btn sm warn" data-a="varDelete" data-id="${v.id}" ${varUsed(v)||v.deleted?'disabled':''}>삭제</button></td></tr>`).join('')}</tbody></table></div></div>`;};
function variableModal(pid,v){showModal({title:v?'변수 편집':'변수 등록',m:{k:v?.key||'',d:v?.desc||'',type:v?.type||'text',e:v?.ex||'',active:v?.active??true},body:()=>mIn('k','변수 키','customer_name',1)+mIn('d','설명')+mSel('type','자료형',[['text','텍스트'],['number','정수/소수'],['date','날짜 YYYY-MM-DD'],['link','HTTP/HTTPS 링크']])+mIn('e','값','',1)+`<label class="chk"><input type="checkbox" data-m="active" ${M('active')?'checked':''}>사용</label>`,ok:'저장',onOk:()=>{const key=M('k').trim(),error=checkVariable(pid,key,M('type'),M('e'),v?.id);if(error){toast(error);return false;}if(v&&varUsed(v)&&v.key!==key){toast('사용 중인 변수는 키를 변경할 수 없습니다');return false;}const item=v||{id:uid('v'),pid,by:S.me,at:now(),log:[]},before=v?JSON.stringify([v.key,v.type,v.ex,v.active]):'';Object.assign(item,{key,desc:M('d'),type:M('type'),ex:M('e'),active:M('active')});item.log.push({at:now(),by:S.me,act:v?'변경':'등록',before,after:JSON.stringify([item.key,item.type,item.ex,item.active])});if(!v)S.vars.push(item);render();}});}
A.varNew=el=>variableModal(el.dataset.pid);
A.varEdit=el=>{const v=S.vars.find(x=>x.id===el.dataset.id);variableModal(v.pid,v);};
A.varDelete=el=>{const v=S.vars.find(x=>x.id===el.dataset.id);if(varUsed(v))return toast('사용 중인 변수는 삭제할 수 없습니다');v.active=false;v.deleted=true;v.log.push({at:now(),by:S.me,act:'삭제 (이력 보존)'});render();};
A.varCreate=()=>toast('고객사 관리자의 변수 관리에서 등록한 변수를 검색해 선택하세요');
const baseVarPick=A.varPick;
A.varPick=(...args)=>{baseVarPick(...args);const fn=UI.pop?.fn;if(fn){UI.pop.fn=()=>fn().replace(/<div style="padding:12px;border-top:1px solid var\(--line\)">[\s\S]*$/,'');renderOv();}};
/* Actual attachment bytes are kept separately in IndexedDB, by immutable version key. */
let fileDBPromise;
function fileDB(){return fileDBPromise ||= new Promise((resolve,reject)=>{const q=indexedDB.open('tx-tms-files-v01',1);q.onupgradeneeded=()=>q.result.createObjectStore('files');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
async function putFile(file,key){const db=await fileDB();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function getFile(key){const db=await fileDB();return new Promise((resolve,reject)=>{const q=db.transaction('files').objectStore('files').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function inspectFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['pdf','docx','hwp','xlsx','pptx','txt','png','jpg'].includes(ext))throw new Error('허용 형식: PDF, DOCX, HWP, XLSX, PPTX, TXT, PNG, JPG');
  if(file.size>20*1024*1024)throw new Error('파일당 최대 20MB입니다');
  const head=new Uint8Array(await file.slice(0,512).arrayBuffer()),ascii=new TextDecoder().decode(head);
  const sig={pdf:[37,80,68,70,45],png:[137,80,78,71,13,10,26,10],jpg:[255,216,255],hwp:[208,207,17,224,161,177,26,225]};
  if(sig[ext]&&!sig[ext].every((v,i)=>head[i]===v))throw new Error('확장자와 실제 파일 시그니처가 다릅니다');
  if(['docx','xlsx','pptx'].includes(ext)){if(head[0]!==80||head[1]!==75)throw new Error('올바른 Office 파일이 아닙니다');if(!window.JSZip)throw new Error('Office 검증 도구를 불러오지 못했습니다');const zip=await JSZip.loadAsync(file),path={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'}[ext];if(!zip.file(path)||!zip.file('[Content_Types].xml'))throw new Error('Office 내부 문서 형식이 확장자와 다릅니다');}
  if(ext==='txt'&&(head.includes(0)||/<script|MZ\x90/i.test(ascii)))throw new Error('텍스트 파일 형식 검증 실패');
  return ext;
}
onFile=async function(el){
  const files=[...el.files];if(!files.length)return;if(el.dataset.xlsx){if(files[0].size>20*1024*1024)return toast('XLSX 최대 20MB');return readXlsx(files[0]);}
  const {tab,r,c}=ctxEdit();if(!c||!editable(r,c)||r.uploadBusy)return;const user=S.me;
  r.uploadBusy=true;tab.st.uploads=[];
  const progress=(item,state)=>{item.state=state;render();};
  try{for(const file of files){const item={name:file.name,state:'업로드 중'};tab.st.uploads.push(item);progress(item,'업로드 중');
    const replacing=el.dataset.newver!==undefined,prior=replacing?getFiles(tab.st,c)[+el.dataset.newver]:null;
    const all=r.contents.flatMap(content=>getFiles(tab.st,content));
    if(file.size>20*1024*1024||el.dataset.img===undefined&&(all.length+(replacing?0:1)>10||all.reduce((n,x)=>n+(x.size||0),0)-(prior?.size||0)+file.size>100*1024*1024))throw new Error('파일당 20MB, 요청당 최대 10개·총 100MB입니다');
    await new Promise(resolve=>setTimeout(resolve,200));progress(item,'파일 검사 중');
    const ext=await inspectFile(file);await prototypeScan(file,tab.st.scanOutcome||'safe');
    if(S.me!==user||!editable(r,c))throw new Error('작업 중 권한이 변경되었습니다');
    if(el.dataset.img!==undefined){if(!['png','jpg'].includes(ext))throw new Error('PNG/JPG 이미지를 선택하세요');const reader=new FileReader();reader.onload=()=>{if(S.me===user&&editable(r,c)){const m=mutF(tab,r,c);m.f.cards[+el.dataset.img].img=reader.result;if(m.auto)autosave(tab,c);render();}};reader.readAsDataURL(file);continue;}
    if(prior&&prior.ext!==ext)throw new Error(`수정본은 ${prior.ext} 형식이어야 합니다`);
    const blobKey=uid('blob')+'-'+Date.now();await putFile(file,blobKey);if(S.me!==user||!editable(r,c))throw new Error('작업 중 권한이 변경되었습니다');const m=mutF(tab,r,c),v=(prior?.v||0)+1;
    const meta={id:prior?.id||uid('fl'),name:file.name,ext,unit:EXT_UNIT[ext],size:file.size,total:prior?.total||(['png','jpg'].includes(ext)?1:''),rangeN:prior?.rangeN||(['png','jpg'].includes(ext)?1:''),range:prior?.range||'',v,blobKey,scan:'prototype-safe',vers:[...(prior?.vers||[]),{v,at:now(),by:S.me,name:file.name,blobKey}]};
    if(prior)m.files[+el.dataset.newver]=meta;else m.files.push(meta);if(m.auto)autosave(tab,c);log(r,prior?'파일 수정본 등록':'파일 첨부',`${file.name} v${v}`,c.id);
    progress(item,'업로드 완료');
  }toast('파일 업로드 완료 (검사 결과는 프로토타입 시연입니다)');}catch(e){const item=tab.st.uploads[tab.st.uploads.length-1];if(item){item.state=e.unsafe?'안전하지 않은 파일로 등록 차단':'검사 실패';item.error=e.message;}log(r,'파일 등록 차단',e.message,c.id);toast(e.message);}finally{r.uploadBusy=false;el.value='';persistSafe();render();}
};
A.dlFile=async el=>{const {tab,r,c}=ctxEdit();if(!canView(r))return toast('다운로드 권한이 없습니다');const file=getFiles(tab.st,c)[+el.dataset.i],blob=file.blobKey&&await getFile(file.blobKey);if(!canView(r))return;if(!blob)return toast('시연 파일의 원본이 없습니다. 직접 첨부한 파일을 다운로드할 수 있습니다.');download(blob,file.name);S.audit.unshift({at:now(),by:S.me,act:'파일 다운로드',target:r.id,detail:file.name});persistSafe();};
A.bulkTpl=()=>{const {r}=cur();if(!window.XLSX)return toast('XLSX 도구를 불러오지 못했습니다');const rows=r.type==='알림톡'?[['승인템플릿','본문','버튼명','버튼링크']]:[['발신자','본문','수신거부문구포함']],wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'등록양식');XLSX.writeFile(wb,`${r.type}_등록양식.xlsx`);};
const baseParseRows=parseRows;
parseRows=function(rows){const {r}=cur(),expected=r.type==='알림톡'?['승인템플릿','본문','버튼명','버튼링크']:['발신자','본문','수신거부문구포함'];if(rows.length-1>1000)return toast('최대 1,000행까지 등록할 수 있습니다');if(!rows[0]||expected.some((h,i)=>String(rows[0][i]||'').replace(/\s/g,'')!==h))return toast('열 구조가 다릅니다. 등록 양식을 사용하세요');baseParseRows(rows);UI.bulkRows.forEach(row=>{if(r.type==='알림톡'&&(row.v[1].length>1000||row.v[2].length>14))row.err.push('본문 1,000자 / 버튼명 14자 초과');if(r.type==='문자'&&bytes(row.v[1])+(row.v[2].toUpperCase()==='Y'?24:0)>2000)row.err.push('LMS 2,000바이트 초과');for(const [,key]of row.v.join(' ').matchAll(/#\{([^}]+)\}/g))if(!S.vars.some(v=>v.pid===r.pid&&v.active&&v.key===key))row.err.push(`미등록 변수 ${key}`);row.sel=!row.err.length;});renderOv();};
A.exportX=()=>{const {r}=cur();if(!canView(r)||!isFinal(r))return;showModal({title:'요청 전체 XLSX 반출',body:()=>`<p>${esc(r.title)} · 콘텐츠 ${r.bundle.items.length}건 · ${fISO(r.bundle.at)} (KST)</p>`,ok:'파일 받기',onOk:()=>{if(!canView(r))return false;if(!window.XLSX){toast('XLSX 도구를 불러오지 못했습니다');return false;}const rows=[['콘텐츠 식별자','유형','제목','본문','버튼명','연결값','변수','완료 버전','요청 완료 상태','완료일']];r.bundle.items.forEach(it=>rows.push([it.cid,r.type,it.title,bodyText(r,it.f),(it.f.btns||it.f.cards||[]).map(b=>b.n||b.bn||'').join('\n'),(it.f.btns||it.f.cards||[]).map(b=>b.l||b.bl||'').join('\n'),JSON.stringify(r.bundle.variables),'v'+it.v,ST[r.bundle.status].l,fISO(r.bundle.at)+' (KST)']));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'완료본');XLSX.writeFile(wb,`${r.id}_완료본.xlsx`);S.audit.unshift({at:now(),by:S.me,act:'완료본 반출',target:r.id,detail:'XLSX'});persistSafe();}});};
A.exportF=()=>{const {r}=cur();showModal({title:'첨부 최종본 ZIP',body:()=>'<p>최종 파일과 완료 버전 명세를 함께 다운로드합니다.</p>',ok:'묶음 받기',onOk:async()=>{if(!canView(r)||!isFinal(r))return false;try{if(!window.JSZip)throw new Error('ZIP 도구를 불러오지 못했습니다');const zip=new JSZip(),manifest=[];for(const it of r.bundle.items)for(const f of it.files){const blob=f.blobKey&&await getFile(f.blobKey);if(!blob)throw new Error(`${f.name}: 시연용 파일의 원본이 없습니다`);const name=`${it.cid}/v${f.v}_${f.name.replace(/[\\/:*?"<>|]/g,'_')}`;zip.file(name,blob);manifest.push({content:it.cid,version:it.v,fileVersion:f.v,path:name,total:f.total,range:f.rangeN,unit:f.unit});}zip.file('완료_버전_명세.json',JSON.stringify({request:r.id,completed:fISO(r.bundle.at)+' (KST)',files:manifest},null,2));const blob=await zip.generateAsync({type:'blob'});if(!canView(r))return;download(blob,`${r.id}_첨부_완료본.zip`);S.audit.unshift({at:now(),by:S.me,act:'첨부 반출',target:r.id,detail:'ZIP'});persistSafe();closeModal();}catch(e){toast(e.message);}return false;}});};
A.copyC=el=>{const {r}=cur();if(canView(r))copyText(resolveText(r,bodyText(r,r.bundle.items.find(it=>it.cid===el.dataset.cid).f)));};
A.copyArch=el=>{const r=Rq(el.dataset.id);if(canView(r))copyText(resolveText(r,bodyText(r,r.bundle.items.find(it=>it.cid===el.dataset.cid).f)));};
function vDatasetSeed(){return `<div class="panel"><div class="panel-h"><h3>교정 데이터셋 시드</h3></div><div class="panel-b"><p>문자열·정규표현식 규칙을 등록하고 고객사 × 콘텐츠 유형에 배정합니다.</p><button class="btn pri" data-a="datasetSeed">데이터셋 등록</button></div><table class="tbl"><thead><tr><th>유형</th><th>버전</th><th>규칙 수</th><th>등록일</th></tr></thead><tbody>${S.datasets.map(d=>`<tr><td>${esc(d.type)}</td><td>v${d.v}</td><td>${d.rules.length}</td><td>${fDT(d.at)}</td></tr>`).join('')}</tbody></table></div>`;}
A.datasetSeed=()=>showModal({title:'교정 데이터셋 시드 등록',m:{type:'공통'},body:()=>mSel('type','유형',['공통',...TYPES].map(x=>[x,x]))+mTa('rules','규칙 JSON 배열','[{"mode":"regex","p":"되요","s":"돼요","r":"맞춤법"}]',1),ok:'등록',onOk:()=>{try{const rules=JSON.parse(M('rules'));if(!Array.isArray(rules)||!rules.length)throw new Error('규칙 배열을 입력하세요');rules.forEach(rule=>{if(!rule.p||!(typeof rule.s==='string'||Array.isArray(rule.s)&&rule.s.length&&rule.s.every(x=>typeof x==='string'))||!['string','regex',undefined].includes(rule.mode))throw new Error('mode, p, s, r 형식을 확인하세요');if(rule.mode==='regex')new RegExp(rule.p,'gu');rule.id=uid('rule');});S.datasets.push({id:uid('ds'),type:M('type'),v:Math.max(0,...S.datasets.filter(d=>d.type===M('type')).map(d=>d.v))+1,status:'deployed',rules,at:now(),by:S.me});S.audit.unshift({at:now(),by:S.me,act:'교정 데이터셋 시드 등록',target:M('type'),detail:`${rules.length}개 규칙`});render();}catch(e){toast(e.message);return false;}}});
const baseStandards=vStandards;
vStandards=tab=>{if(!['types','assign','ds'].includes(tab.st.sub))tab.st.sub='assign';if(tab.st.sub==='ds')return `<div class="page"><div class="ph"><h1>교정 데이터셋</h1><button class="btn" data-a="sub" data-k="assign">배정표</button></div>${vDatasetSeed()}</div>`;const html=baseStandards(tab);return html.replace(/<button[^>]*data-a="sub" data-k="(guide|fb|prop|opsNotice)"[\s\S]*?<\/button>/g,'').replace(/<button[^>]*data-a="sub" data-k="ds"[\s\S]*?<\/button>/,'<button class="btn" data-a="sub" data-k="ds">데이터셋 시드</button>');};
/* Authentication demonstrations use local password hashes and one-use links. */
const passwordOK=p=>p.length>=8&&[/[A-Za-z]/,/\d/,/[^A-Za-z0-9]/].filter(re=>re.test(p)).length>=2;
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function mail(to,subject,body){S.outbox.unshift({id:uid('mail'),to,subject,body,at:now(),status:'시연 발송 대기'});}
function invitation(user){S.invitations.filter(i=>i.uid===user.id&&!i.used).forEach(i=>i.revoked=true);const item={token:crypto.randomUUID(),uid:user.id,expires:now()+7*DAY,used:false};S.invitations.push(item);mail(user.email,'TX TMS 초대',`${location.href.split('#')[0]}#/invite/${item.token}`);return item;}
const baseLogin=A.login;
A.login=el=>{const user=U(el.dataset.u);if(!user.active||user.cid&&Cu(user.cid)?.active===false)return toast('비활성 계정 또는 고객사입니다');const savedTabs=localStorage.getItem(TAB_KEY+':'+user.id);baseLogin(el);session={uid:S.me,remember:!!UI.remember,started:Date.now(),last:Date.now()};localStorage.setItem(SESSION_KEY,JSON.stringify(session));try{const tabs=JSON.parse(savedTabs||'[]');UI.tabs=tabs.slice(0,10).filter(t=>ROUTES[t.route]).map(t=>mkTab(t.route,t.p));if(!UI.tabs.length)UI.tabs=[mkTab('home')];UI.active=UI.tabs[0].id;render();}catch(e){}};
const baseLogout=A.logout;
A.logout=()=>{persistSafe();localStorage.removeItem(SESSION_KEY);session=null;baseLogout();};
const baseLoginView=vLogin;
vLogin=()=>baseLoginView().replace('<div class="row" style="margin-bottom:26px">','<label class="chk" style="margin-bottom:12px"><input type="checkbox" id="lg-remember">로그인 유지 (최대 14일)</label><div class="row" style="margin-bottom:26px">').replace('data-a="invite">초대 링크로 가입','data-a="passwordReset">비밀번호 재설정').replace('체험 로그인은 실제 인증과 계정 연결을 정의한 화면이 아닙니다. 화면의 수치와 이력은 시연용입니다.','체험 계정은 시연용입니다. 초대 계정은 비밀번호 설정 후 로그인할 수 있습니다. 인증·메일·저장은 이 브라우저에서 시연합니다.').replace(/<span class="tag flag"[^>]*>[\s\S]*?<\/span>/g,'');
A.loginForm=async()=>{const user=S.users.find(u=>u.email.toLowerCase()===$('#lg-e').value.trim().toLowerCase());if(!user?.passwordHash)return toast('초대 링크에서 비밀번호를 먼저 설정하거나 체험 계정을 사용하세요');if(await passwordHash($('#lg-p').value,user.salt)!==user.passwordHash)return toast('이메일 또는 비밀번호를 확인하세요');UI.remember=$('#lg-remember').checked;A.login({dataset:{u:user.id}});};
A.inviteUser=()=>showModal({title:'사용자 초대',m:{pid:S.pid,role:'requester'},body:()=>mIn('email','이메일','name@company.com',1)+mIn('name','이름','',1)+mSel('pid','프로젝트',S.projects.filter(p=>p.cid===S.cid).map(p=>[p.id,p.name]))+mSel('role','역할',[['requester','요청자'],['reviewer','검수자'],...(Cu(S.cid).approval?[['approver','승인자']]:[])])+`<p class="small">회사 외부 도메인 이메일도 초대할 수 있습니다.</p>${M('email')&&!String(M('email')).toLowerCase().endsWith('@'+Cu(S.cid).domain)?'<p class="banner danger">외부 도메인 이메일입니다. 초대 대상을 확인하세요.</p>':''}`,ok:'초대 링크 생성',onOk:()=>{if(!isAdmin(S.cid)||!need(['email','이메일'],['name','이름']))return false;const email=M('email').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('이메일 형식을 확인하세요');return false;}if(S.users.some(u=>u.email.toLowerCase()===email)){toast('이미 등록된 이메일입니다');return false;}const user={id:uid('u'),name:M('name'),email,dept:'초대 대기',cid:S.cid,active:false,pending:true,color:'#6A6F7A'};S.users.push(user);P(M('pid')).members[user.id]=[M('role')];invitation(user);S.audit.unshift({at:now(),by:S.me,act:'사용자 초대',target:user.name,detail:email});persistSafe();toast('초대 링크를 생성했습니다. 사용자 관리의 발송 대기함에서 확인하세요');render();}});
A.inviteResend=el=>{const user=U(el.dataset.id);if(!isAdmin(S.cid)||user.cid!==S.cid||!user.pending)return;invitation(user);persistSafe();toast('이전 링크를 무효화하고 7일 유효한 새 초대 링크를 생성했습니다');render();};
const baseUsers=vUsers;
vUsers=tab=>baseUsers(tab).replace('</tbody></table>',`${S.users.filter(u=>u.cid===S.cid&&u.pending).map(u=>`<tr><td colspan="9">${esc(u.email)} · 초대 대기 <button class="btn sm" data-a="inviteResend" data-id="${u.id}">초대 재발급</button></td></tr>`).join('')}</tbody></table>`)+`<div class="page"><div class="panel"><div class="panel-h"><h3>메일 발송 대기함 (브라우저 시연)</h3></div>${S.outbox.filter(m=>S.users.some(u=>u.cid===S.cid&&u.email===m.to)).map(m=>`<div class="panel-b"><b>${esc(m.subject)} · ${esc(m.to)}</b><p style="overflow-wrap:anywhere">${esc(m.body)}</p><span class="small">${esc(m.status)}</span></div>`).join('')||'<div class="panel-b">발송 대기 메일이 없습니다.</div>'}</div></div>`;
vInvite=function(){const [,kind,token]=location.hash.split('/'),item=(kind==='reset'?S.resets:S.invitations).find(i=>i.token===token),user=item&&U(item.uid),valid=item&&!item.used&&!item.revoked&&item.expires>Date.now();return `<div class="login"><section class="login-l"><h1>${kind==='reset'?'비밀번호 재설정':'초대 수락'}</h1><p>${valid?esc(user.email):'유효하지 않거나 만료된 링크입니다. 관리자에게 재발급을 요청하세요.'}</p></section><section class="login-r">${valid?`<div class="fld"><label>이름</label><input class="in" id="invite-name" value="${esc(user.name)}" ${kind==='reset'?'disabled':''}></div><div class="fld"><label>비밀번호</label><input class="in" id="invite-password" type="password"><p class="small">8자 이상, 영문·숫자·특수문자 중 2종 이상</p></div><button class="btn pri" data-a="acceptInvite">비밀번호 설정</button>`:''}<button class="btn ghost" data-a="toLogin">로그인으로 돌아가기</button></section></div>`;};
A.acceptInvite=async()=>{const [,kind,token]=location.hash.split('/'),item=(kind==='reset'?S.resets:S.invitations).find(i=>i.token===token);if(!item||item.used||item.revoked||item.expires<Date.now())return toast('유효하지 않은 링크입니다');const password=$('#invite-password').value;if(!passwordOK(password))return toast('비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종 이상이어야 합니다');const user=U(item.uid),name=$('#invite-name').value.trim();if(!name)return toast('이름을 입력하세요');user.salt=crypto.randomUUID();user.passwordHash=await passwordHash(password,user.salt);user.name=name;if(kind!=='reset'){user.active=true;user.pending=false;}item.used=true;persistSafe();location.hash='#/home';A.login({dataset:{u:user.id}});};
A.passwordReset=()=>showModal({title:'비밀번호 재설정',body:()=>mIn('email','이메일','',1),ok:'재설정 링크 생성',onOk:()=>{const user=S.users.find(u=>u.email.toLowerCase()===String(M('email')).trim().toLowerCase());if(user?.active&&!user.pending){S.resets.filter(i=>i.uid===user.id).forEach(i=>i.revoked=true);const item={token:crypto.randomUUID(),uid:user.id,expires:now()+3600000};S.resets.push(item);mail(user.email,'TX TMS 비밀번호 재설정',`${location.href.split('#')[0]}#/reset/${item.token}`);persistSafe();showModal({title:'비밀번호 재설정 링크 (브라우저 시연)',body:()=>`<p>이 링크는 1시간 동안 한 번 사용할 수 있습니다.</p><button class="btn" data-a="openReset" data-token="${item.token}">비밀번호 재설정하기</button>`,ok:'닫기'});}else toast('등록된 계정이면 재설정 안내가 생성됩니다');}});
A.openReset=el=>{UI.modal=null;UI.screen='invite';location.hash='#/reset/'+el.dataset.token;render();};
window.addEventListener('hashchange',()=>{if(/^#\/(invite|reset)\//.test(location.hash)){if(S.me)A.logout();UI.screen='invite';render();}});
function sessionCheck(time=Date.now()){if(session&&S.me&&(session.remember?time-session.started>=14*DAY:time-session.last>=30*60000)){A.logout();toast('세션이 만료되었습니다. 다시 로그인하세요');}}
for(const event of ['pointerdown','keydown','input'])document.addEventListener(event,()=>{sessionCheck();if(session){session.last=Date.now();localStorage.setItem(SESSION_KEY,JSON.stringify(session));}},{passive:true});
function canViewFor(r,user){return U(user).active&&Cu(P(r.pid).cid).active!==false&&(r.status!=='draft'||r.by===user)&&(isMember(r.pid,user)||(U(user).admin||[]).includes(P(r.pid).cid));}
function pendingFor(r,user){if(!canViewFor(r,user))return false;return r.status==='wait'?P(r.pid).lead===user:r.status==='ask'?r.by===user:r.status==='appr'?approvers(r.pid).includes(user)&&user!==r.by&&!r.reviewers.includes(user):r.status==='review'?r.recall?r.primary===user:r.reviewers.includes(user):false;}
function processReminders(time=Date.now()){
  S.notifs.filter(n=>n.req&&!n.renotify).forEach(n=>{const r=Rq(n.req);if(!r||!pendingFor(r,n.uid)||n.uid===n.actor)return;const urgent=!isFinal(r)&&r.due&&r.due-time<=custOf(r).ops.dueSoonDays*DAY,key=`${r.id}:${n.uid}`;r.reminders ||= {};const state=r.reminders[key] ||= {count:0,last:n.at,due:r.due};if(state.due!==r.due){state.count=0;state.last=time;state.due=r.due;}if(state.count>=3||time-state.last<DAY)return;state.count++;state.last=time;const text=`${urgent?'납기 임박':'미처리'} 재통지 ${state.count}/3: ${r.title}`;S.notifs.unshift({id:uid('nt'),uid:n.uid,at:time,kind:urgent?'due':n.kind,req:r.id,text,read:false,renotify:true});if(urgent&&state.count===3&&custOf(r).ops.notifyChannel.includes('이메일'))mail(U(n.uid).email,text,r.id);});
  S.audit=S.audit.filter(a=>!['요청 조회','파일 다운로드','완료본 반출','첨부 반출'].includes(a.act)||time-a.at<=3*365*DAY);
}
const baseNotify=notify;
notify=function(users,text,req,kind='info'){baseNotify(users,text,req,kind);S.notifs.filter(n=>n.req===req&&n.text===text).forEach(n=>n.actor=S.me);};
A.openNotif=el=>{const n=S.notifs.find(n=>n.id===el.dataset.id&&n.uid===S.me);if(!n)return;if(n.req&&!canView(Rq(n.req)))return toast('이 요청을 볼 권한이 없습니다');n.read=true;UI.pop=null;if(n.req){const r=Rq(n.req);S.pid=r.pid;S.cid=P(r.pid).cid;openTab('request',{id:r.id});}else render();};
setInterval(()=>{expireLocks();sessionCheck();processReminders();if(S.me&&!UI.tabs.some(t=>t.dirty))persistSafe();},60000);
/* Every mutating action and delayed modal commit passes through the same policy. */
const phase2Actions=new Set(['theme','pub','fpReport','guideSave','dsNew','dsDeploy','dsRestore','dsConflict','dsDiff','resolve','ruleAdd','ruleDel','grant','revoke']);
const policies={submit:'submit',cancelReq:'cancel',recallReq:'recall',recallDecide:'decideRecall',dueEdit:'due',complete:'complete',approve:'approve',revise:'approve',answer:'answer',sendAsk:'review',addOp:'review',cloneReq:'clone',followUp:'clone',followUp2:'clone'};
function actionAllowed(name,el){
  if(phase2Actions.has(name))return false;
  const r=Rq(el?.dataset?.id)||Rq(activeTab()?.p?.id);
  if(policies[name])return !!r&&canView(r)&&can[policies[name]](r);
  if(name==='assign')return !!r&&canView(r)&&(el.dataset.change==='1'?can.change(r):can.assign(r));
  if(['addC','delC','bulk','typeChange'].includes(name))return !!r&&canView(r)&&can.editReq(r)&&(name!=='delC'||r.contents.length>1);
  if(['saveRev','addBtn','rmBtn','rmFile','applyIssue','insVar'].includes(name)){const ctx=ctxEdit();return !!ctx.c&&editable(ctx.r,ctx.c)&&(name!=='addBtn'||getF(ctx.tab.st,ctx.c).btns.length<5);}
  if(['check','checkAll'].includes(name)){const ctx=ctxEdit();return !!ctx.c&&canView(ctx.r)&&(name==='checkAll'||!(ctx.r.type==='자유입력형'&&getFiles(ctx.tab.st,ctx.c).length));}
  if(['copyArch','followUp2','openC2','dlFile','exportX','exportF','copyC'].includes(name))return !!r&&canView(r);
  if(name==='unlock')return !!r&&canView(r)&&(P(r.pid).lead===S.me||isAdmin(P(r.pid).cid));
  if(['projEdit','roleEdit','deact','inviteUser','varNew','varEdit','varDelete','noticeEdit','noticeWithdraw','inviteResend'].includes(name)){
    const object=['roleEdit','deact','inviteResend'].includes(name)?U(el.dataset.id):['varEdit','varDelete'].includes(name)?S.vars.find(v=>v.id===el.dataset.id):null;
    return isAdmin(S.cid)&&(!object||object.cid===S.cid||P(object.pid)?.cid===S.cid)&&(!el.dataset.pid||P(el.dataset.pid)?.cid===S.cid);
  }
  if(/^(opsCust|seed|asConfirm|datasetSeed)/.test(name))return isOps();
  return true;
}
for(const name of Object.keys(A)){if(['modalOk','login','loginForm','invite','toLogin','logout','reset','passwordReset','acceptInvite','openReset'].includes(name))continue;const original=A[name];A[name]=function(el={dataset:{}},...args){if(!actionAllowed(name,el)){toast('현재 역할과 요청 상태에서 이 작업을 실행할 수 없습니다');return false;}const before=UI.modal,result=original(el,...args);if(UI.modal&&UI.modal!==before&&UI.modal.onOk){const modal=UI.modal,commit=modal.onOk;modal.onOk=()=>{if(!actionAllowed(name,el)){toast('권한 또는 요청 상태가 변경되었습니다');return false;}return commit();};}return result;};}
const baseSaveRev=A.saveRev;
A.saveRev=el=>{const {r,c}=ctxEdit();expireLocks();if(!c||!editable(r,c)||c.lockBy!==S.me)return toast('편집 잠금이 만료되었습니다. 최신 버전을 다시 불러오세요');const before=c.v,result=baseSaveRev(el);if(r.status==='ask'&&c.v!==before)r.answerChanged=true;persistSafe();return result;};
const baseAnswer=A.answer;
A.answer=el=>{const {r}=cur(),before=r.status,result=baseAnswer(el);if(before==='ask'&&r.status==='review'&&r.answerChanged){r.round++;r.answerChanged=false;log(r,'재검수 시작',`확인 응답의 문안 수정으로 ${r.round}차 검수`);render();}return result;};
const baseCancel=A.cancelReq;
A.cancelReq=el=>{const result=baseCancel(el);if(UI.modal?.onOk){const commit=UI.modal.onOk;UI.modal.onOk=()=>{const {r}=cur(),result=commit();if(r.status==='draft'){r.roundBump=false;r.cancelled=true;persistSafe();}return result;};}return result;};
const baseSubmit=A.submit;
A.submit=el=>{if(!persistSafe())return toast(storeError);const result=baseSubmit(el);if(UI.modal?.title==='검수를 요청할까요?'){const commit=UI.modal.onOk;UI.modal.onOk=()=>{if(!persistSafe()){toast(storeError);return false;}const {r}=cur();if(validateReq(r).list.length){toast('필수값이 변경되었습니다. 다시 확인하세요');return false;}const result=commit();persistSafe();return result;};}return result;};
const baseComplete=A.complete;
A.complete=el=>{const {r}=cur();if(!can.complete(r)||!canView(r))return toast('주담당 검수자만 완료할 수 있습니다');if(custOf(r).approval&&!approvers(r.pid).some(u=>u!==r.by&&u!==r.primary&&!r.reviewers.includes(u))){notify(S.users.filter(u=>(u.admin||[]).includes(P(r.pid).cid)).map(u=>u.id),'적격 승인자 지정을 요청합니다: '+r.title,r.id);notify([r.by,P(r.pid).lead],'적격 승인자 부재로 완료가 지연됩니다: '+r.title,r.id);persistSafe();return toast('적격 승인자가 없습니다. 고객사 관리자에게 지정을 요청했습니다');}if(r.contents.some(c=>c.lockBy&&c.lockBy!==S.me))return toast('다른 검수자가 편집 중입니다. 저장과 잠금 해제 후 완료하세요');const result=baseComplete(el);if(UI.modal?.onOk){const commit=UI.modal.onOk;UI.modal.onOk=()=>{if(!can.complete(r))return false;if(custOf(r).approval&&!approvers(r.pid).some(u=>u!==r.by&&u!==r.primary&&!r.reviewers.includes(u)))return false;if(validateReq(r).list.length){toast('최종 콘텐츠의 필수값과 연결값을 확인하세요');return false;}return commit();};}return result;};
/* Input handlers also validate authorization; data attributes alone confer no rights. */
for(const name of ['varAct','custName','custOps']){const fn=IN[name];IN[name]=(el,e)=>{if(!isAdmin(S.cid))return toast('관리자 권한이 필요합니다');return fn(el,e);};}
for(const name of ['tyAct','tyMock','asSet','seedCust','rule','fbSt','fbReply','fbVer','propSt']){const fn=IN[name];IN[name]=(el,e)=>{if(!isOps())return toast('운영 담당자 권한이 필요합니다');if(['rule','fbSt','fbReply','fbVer','propSt'].includes(name))return;return fn(el,e);};}
IN.ctitle=(el,e)=>{const {tab,r,c}=ctxEdit();if(e.type==='input'&&can.editReq(r)&&canView(r)){c.title=el.value;autosave(tab,c);}};
vSpec=()=>`<div class="page"><div class="ph"><div><h1>plan_v01 기능 대응표</h1><p>Phase 1 · 브라우저 프로토타입</p></div></div><div class="panel"><table class="tbl"><thead><tr><th>기획 절</th><th>기능</th><th>화면 / 동작</th></tr></thead><tbody>${[['1–4','고객사·프로젝트·6개 역할·권한','프로젝트 / 사용자·권한 / 요청 상태별 작업 검사'],['5','로그인·초대·재발급·비밀번호·세션','로그인 / 사용자 관리 / 발송 대기함'],['6–8','요청 상태·작성·저장·복제','요청 / 자동 저장 30초·입력 멈춤·3회 재시도'],['9–11','4종 콘텐츠·첨부·XLSX','요청 콘텐츠 / 실제 파일 업로드·다운로드'],['12–13','변수·문자열/정규표현식 교정','변수 관리 / 교정 / 데이터셋 시드·배정'],['14–22','취소·배정·검수·확인·회수·완료·승인','요청 상세 / 차수와 콘텐츠 버전 분리'],['23–26','완료 묶음·반출·검색·이력','완료 결과 / XLSX·ZIP / 검색 / 통합 이력'],['27–30','납기·업무량·실적·대시보드','역할별 대시보드 / 업무량·실적'],['31–34','알림·재통지·공지·최대 10개 탭','알림 / 공지 / 업무 탭'],['35–36','고객사 관리·솔루션 운영','관리 메뉴 / 고객사·유형·초기 설정·시드'],['37–40','Phase 경계·핵심 규칙','후속 기능 작업 차단 / 기획 대응 분석 문서']].map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>서버 권한 검증·실제 이메일·바이러스 검사·예약 작업은 운영 서버 연동이 필요합니다. 저장 데이터와 비밀번호 해시는 이 브라우저에만 보존됩니다.</p></div>`;
restoreStore();
if(/^#\/(invite|reset)\//.test(location.hash))UI.screen='invite';
try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(saved&&U(saved.uid).active&&(saved.remember?Date.now()-saved.started<14*DAY:Date.now()-saved.last<30*60000)){UI.remember=saved.remember;A.login({dataset:{u:saved.uid}});session=saved;}}catch(e){}
render();
// Additional administrative invariants and form validation.
const baseDueEdit=A.dueEdit;
A.dueEdit=el=>{const result=baseDueEdit(el);if(UI.modal?.onOk){const commit=UI.modal.onOk;UI.modal.onOk=()=>{if(!pISO(M('due'))){toast('확정 납기를 입력하세요');return false;}const result=commit();const {r}=cur();if(r)r.reminders={};return result;};}return result;};
const baseAssign=A.assign;
A.assign=el=>{const result=baseAssign(el);if(UI.modal?.onOk){const commit=UI.modal.onOk;UI.modal.onOk=()=>{if(el?.dataset?.change!=='1'&&!pISO(M('due'))){toast('확정 납기를 입력하세요');return false;}return commit();};}return result;};
const baseTabAddR=A.newTabR;
A.newTabR=el=>{if(UI.tabs.length>=10&&!UI.tabs.some(t=>t.route===el.dataset.r))return toast('업무 탭은 최대 10개입니다');return baseTabAddR(el);};
const baseDeact=A.deact;
A.deact=el=>{const user=U(el.dataset.id);if(S.requests.some(r=>['ask','appr'].includes(r.status)&&r.reviewers.includes(user.id)))return toast('확인 요청·승인 대기 중에는 담당자를 변경할 수 없습니다. 해당 업무를 먼저 처리하세요');const result=baseDeact(el);if(UI.modal?.onOk){const commit=UI.modal.onOk;UI.modal.onOk=()=>{const sub=M('sub');if(S.requests.some(r=>r.status==='review'&&r.reviewers.includes(user.id)&&(r.by===sub||hasRequesterRole(sub,r.pid)))){toast('해당 프로젝트의 요청자를 대체 검수자로 지정할 수 없습니다');return false;}if(S.projects.some(p=>Cu(p.cid).approval&&approvers(p.id).includes(user.id)&&approvers(p.id).length===1)){toast('마지막 승인자입니다. 새 승인자를 먼저 지정하세요');return false;}return commit();};}return result;};
function hasRequesterRole(user,pid){return roles(user,pid).includes('requester');}
const baseOpsNew=A.opsCustNew;
A.opsCustNew=el=>{const result=baseOpsNew(el);if(UI.modal?.onOk){const commit=UI.modal.onOk;UI.modal.onOk=()=>{const ids=new Set(S.customers.map(c=>c.id)),result=commit(),customer=S.customers.find(c=>!ids.has(c.id));if(customer){customer.sample=false;const project={id:uid('p'),cid:customer.id,name:'기본 프로젝트',active:true,lead:null,members:{},tpls:[],senders:[]};S.projects.push(project);S.pid=project.id;S.seedLog.unshift({at:now(),cid:customer.id,by:S.me,act:'기본 프로젝트 생성',target:project.name,result:'첫 고객사 관리자 초대 필요'});persistSafe();render();}return result;};}return result;};
A.seedUser=el=>{if(!isOps())return toast('운영 담당자 권한이 필요합니다');const cid=el.dataset.cid,admin=el.dataset.role==='admin',projects=S.projects.filter(p=>p.cid===cid);showModal({title:admin?'첫 고객사 관리자 초대':'초기 업무 사용자 초대',m:{pid:projects[0]?.id||'',role:'requester'},body:()=>mIn('email','이메일','',1)+mIn('name','이름','',1)+mIn('dept','소속')+(admin?'':mSel('pid','프로젝트',projects.map(p=>[p.id,p.name]))+mSel('role','역할',[['requester','요청자'],['reviewer','검수자'],...(Cu(cid).approval?[['approver','승인자']]:[])]))+`<p class="small">${M('email')&&!String(M('email')).endsWith('@'+Cu(cid).domain)?'외부 도메인 이메일입니다. 초대 대상을 확인하세요.':''}</p>`,ok:'초대 링크 생성',onOk:()=>{if(!isOps()||!need(['email','이메일'],['name','이름']))return false;const email=M('email').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||S.users.some(u=>u.email.toLowerCase()===email)){toast('이메일 형식 또는 중복을 확인하세요');return false;}const user={id:uid('u'),email,name:M('name'),dept:M('dept')||'초대 대기',cid,active:false,pending:true,color:'#6A6F7A'};if(admin)user.admin=[cid];else{if(!P(M('pid'))){toast('프로젝트가 필요합니다');return false;}P(M('pid')).members[user.id]=[M('role')];}S.users.push(user);invitation(user);S.seedLog.unshift({at:now(),by:S.me,cid,act:'초대 링크 생성',target:email,result:admin?'고객사 관리자':'업무 사용자'});persistSafe();const link=S.outbox[0].body;showModal({title:'초대 링크 생성 완료',body:()=>`<p>7일 동안 유효합니다. 실제 메일 발송은 서버 연동 대상입니다.</p><p style="overflow-wrap:anywhere">${esc(link)}</p>`,ok:'닫기'});}});};
for(const name of ['seedSample','seedClear']){const fn=A[name];A[name]=el=>{if(!isOps()||!Cu(el.dataset.cid)?.sample)return toast('샘플 데이터 작업은 샘플 고객사에서만 가능합니다');return fn(el);};}
const baseReset=A.reset;
A.reset=()=>{if(!isOps())return toast('시연 데이터 초기화는 솔루션 운영 담당자만 실행할 수 있습니다');return showModal({title:'샘플 고객사 데이터 초기화',body:()=>'<p>기본 체험 고객사의 시연 요청만 초기화합니다. 실제 고객사 데이터는 유지됩니다.</p>',ok:'초기화',onOk:()=>{const fresh=seed(),ids=S.customers.filter(c=>c.sample).map(c=>c.id),pids=S.projects.filter(p=>ids.includes(p.cid)).map(p=>p.id);S.requests=S.requests.filter(r=>!pids.includes(r.pid)).concat(fresh.requests.filter(r=>pids.includes(r.pid)));S.audit.unshift({at:now(),by:S.me,act:'샘플 초기화',target:ids.join(', '),detail:'실제 고객사 보존'});restoreSeedVariables();persistSafe();render();}});};
function restoreSeedVariables(){const keys={'고객명':'customer_name','적립포인트':'points','이벤트기간':'event_period','청구금액':'billing_amount','결제일':'payment_day','카드명':'card_name','기준일':'reference_date','납입일':'due_date','보험료':'premium'};for(const [old,key]of Object.entries(keys))S.requests.forEach(r=>r.contents.forEach(c=>{c.f=JSON.parse(JSON.stringify(c.f).split('#{'+old+'}').join('#{'+key+'}'));}));}
S.customers.filter(c=>['c1','c2'].includes(c.id)).forEach(c=>c.sample=true);
// Client side event metadata for reminder completion: reading is independent from work.
A.notifs=el=>openPop(()=>{const ns=S.notifs.filter(n=>n.uid===S.me);return `<div class="pop-h"><b>알림</b><span class="small faint">24시간 간격 · 최대 3회</span><button class="btn sm ghost" data-a="readAll">모두 읽음</button></div><div class="pop-b">${ns.map(n=>{const r=Rq(n.req),done=r?!pendingFor(r,n.uid):false;return `<div class="nt ${n.read?'read':''}" data-a="openNotif" data-id="${n.id}"><span class="ud"></span><div class="nm">${esc(n.text)}<span>${fDT(n.at)} · ${n.read?'읽음':'안 읽음'} · ${done?'업무 처리 완료':'업무 미처리'}${n.renotify?' · 재통지':''}</span></div></div>`;}).join('')||'<div class="empty">알림이 없습니다</div>'}</div>`;},el);
const baseResult=vResult;
vResult=(tab,r)=>baseResult(tab,r)+`<div class="panel" style="margin-top:16px"><div class="panel-h"><h3>완료 당시 변수 값</h3></div><div class="panel-b">${(r.bundle?.variables||[]).map(v=>`<div>${esc(v.key)} = ${esc(v.ex)}</div>`).join('')||'변수 없음'}</div></div>`;
const basePerf=vPerf;
vPerf=tab=>basePerf(tab).replace('<label>기간</label>','<label>기간 (접수일 KST)</label>').replace('<div class="f"><label>프로젝트</label>',`<div class="f"><label>접수일 직접 지정</label><div class="row"><input type="date" class="in" aria-label="집계 시작일" data-i="flt" data-k="from" value="${esc(tab.st.f?.from||'')}"><input type="date" class="in" aria-label="집계 종료일" data-i="flt" data-k="to" value="${esc(tab.st.f?.to||'')}"></div></div><div class="f"><label>프로젝트</label>`);
const baseModalOk=A.modalOk;
A.modalOk=async()=>{const modal=UI.modal;if(!modal||modal.busy)return;modal.busy=true;try{const result=await modal.onOk?.();if(result!==false&&UI.modal===modal)closeModal();}catch(e){toast(e.message);}finally{modal.busy=false;}};
render();
function smsBytes(f){return bytes((f.body||'')+(f.cs?'\n고객센터 1588-0000':'')+(f.optout?'\n무료 수신거부 080-000-0000':''));}
const validationBeforeSms=validateReq;
validateReq=function(r){const result=validationBeforeSms(r);if(r.type==='문자')r.contents.forEach(c=>{if(smsBytes(c.f)>2000&&!result.list.some(x=>x.includes(c.id)&&x.includes('2,000')))result.list.push(c.id+': LMS 최대 2,000바이트 (안내 포함)');});return result;};
const baseSide=vSide;
vSide=()=>baseSide().replace(/(기능 대응표[^<]*)99/g,'$1').replace(/<span class="cnt">99<\/span>/g,'');
visibleNotices=function(){return S.notices.filter(n=>!n.withdrawn&&(n.scope==='customer'&&n.cid===S.cid&&(me().cid===n.cid||isAdmin(n.cid))||n.scope==='project'&&P(n.pid)?.cid===S.cid&&(isMember(n.pid)||isAdmin(S.cid)))).sort((a,b)=>b.at-a.at);};
const userViewWithEmail=vUsers;
vUsers=tab=>userViewWithEmail(tab).replace(/(<button class="btn sm" data-a="roleEdit" data-id="([^"]+)">역할<\/button>)/g,'$1<button class="btn sm" data-a="userEmail" data-id="$2">이메일</button>');
A.userEmail=el=>{const user=U(el.dataset.id);if(!isAdmin(S.cid)||user.cid!==S.cid)return toast('고객사 관리자 권한이 필요합니다');showModal({title:'사용자 이메일 변경',m:{email:user.email},body:()=>mIn('email','이메일','',1),ok:'저장',onOk:()=>{if(!isAdmin(S.cid)||user.cid!==S.cid)return false;const email=M('email').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||S.users.some(u=>u.id!==user.id&&u.email.toLowerCase()===email)){toast('이메일 형식 또는 중복을 확인하세요');return false;}const before=user.email;user.email=email;if(user.pending)invitation(user);S.audit.unshift({at:now(),by:S.me,act:'사용자 이메일 변경',target:user.name,detail:before+' → '+email});render();}});};
const guardBeforeNotices=actionAllowed;
actionAllowed=function(name,el){if(['noticeEdit','noticeWithdraw'].includes(name)&&el?.dataset?.id){const n=S.notices.find(x=>x.id===el.dataset.id);if(!n||n.cid!==S.cid||!['project','customer'].includes(n.scope))return false;}if(name==='projEdit'&&el?.dataset?.id&&P(el.dataset.id)?.cid!==S.cid)return false;return guardBeforeNotices(name,el);};
// Keep tab state local to its request; prevent stale role changes from writing content fields.
const originalOnField=onField;
onField=function(e){if(e.target.dataset.ff){const k=e.target.dataset.ff.split('.')[1];if(!['total','rangeN','range'].includes(k))return;}return originalOnField(e);};
render();
const viewBeforePhaseBoundary=render;
render=function(){viewBeforePhaseBoundary();const main=$('#main');if(main)main.querySelectorAll('button').forEach(button=>{if(['운영 지원 접근','접근 부여'].includes(button.textContent.trim()))button.remove();});};
for(const name of ['check','checkAll']){const fn=A[name];A[name]=el=>{const {r}=ctxEdit();if(!r||!canView(r))return toast('교정 대상에 접근할 수 없습니다');if(effectiveRules(r.type,P(r.pid).cid).missing)return toast('유효 교정 데이터셋이 배정되지 않았습니다. 운영 담당자에게 배정을 요청하세요');return fn(el);};}
const beforeVarAction=IN.varAct;
IN.varAct=(el,e)=>{const v=S.vars.find(v=>v.id===el.dataset.id);if(!v||P(v.pid)?.cid!==S.cid)return toast('다른 고객사의 변수는 변경할 수 없습니다');return beforeVarAction(el,e);};
const beforeProjectInput=IN.proj;
IN.proj=el=>{if(!myProjects().some(p=>p.id===el.value))return toast('프로젝트 접근 권한이 없습니다');return beforeProjectInput(el);};
const beforeCustomerInput=IN.cust;
IN.cust=el=>{if(!isOps()&&me().cid!==el.value&&!isAdmin(el.value))return toast('고객사 접근 권한이 없습니다');return beforeCustomerInput(el);};
render();

/* plan_v01 full consistency: dataset candidates retain their source and reversible offsets. */
effectiveRules=function(type,cid=S.cid){const common=assignedDS(cid,'공통'),typeDS=assignedDS(cid,type);return {common,typeDS,missing:!common||!typeDS,label:`공통 v${common?.v||'-'} + ${type} v${typeDS?.v||'-'}`,rules:[...[...(common?.rules||[])].map(x=>({...x,src:'공통 v'+common.v})),...[...(typeDS?.rules||[])].map(x=>({...x,src:type+' v'+typeDS.v}))]};};
runCheck=function(r,c,f=c.f){const eff=effectiveRules(r.type,P(r.pid).cid),issues=[];for(const [key,value]of textFields(r.type,f)){const text=String(value||''),found=[],protectedSpans=[];for(const rule of eff.rules){const options=Array.isArray(rule.s)?rule.s:[rule.s];for(const option of options){if(typeof option!=='string'||!option||option===rule.p||/\$[&`'0-9]/.test(option))continue;let at=text.indexOf(option);while(at>=0){protectedSpans.push([at,at+option.length]);at=text.indexOf(option,at+option.length);}}
if(!rule.p)continue;let matches=[];try{matches=rule.mode==='regex'?[...text.matchAll(new RegExp(rule.p,'gu'))]:[...text.matchAll(new RegExp(String(rule.p).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gu'))];}catch(e){continue;}for(const match of matches){const from=match[0],start=match.index,end=start+from.length;if(!from)continue;const candidates=options.filter(x=>typeof x==='string').map(x=>({text:rule.mode==='regex'?from.replace(new RegExp(rule.p,'u'),x):x,reason:rule.r||'데이터셋 권장 표현',src:rule.src})).filter(x=>x.text!==from);if(candidates.length)found.push({key,start,end,from,candidates});}}
const grouped=new Map();for(const item of found){if(protectedSpans.some(([s,e])=>s<=item.start&&e>=item.end))continue;const id=item.start+':'+item.end;const old=grouped.get(id);if(old)old.candidates.push(...item.candidates);else grouped.set(id,item);}const accepted=[];for(const item of [...grouped.values()].sort((a,b)=>(b.end-b.start)-(a.end-a.start)||a.start-b.start)){if(accepted.some(x=>item.start<x.end&&item.end>x.start))continue;item.candidates=item.candidates.filter((x,i,a)=>a.findIndex(y=>y.text===x.text&&y.reason===x.reason&&y.src===x.src)===i);item.to=item.candidates[0].text;item.reason=item.candidates.map(x=>x.reason).filter((x,i,a)=>a.indexOf(x)===i).join(' / ');item.src=item.candidates.map(x=>x.src).filter((x,i,a)=>a.indexOf(x)===i).join(' + ');accepted.push(item);}issues.push(...accepted);}issues.sort((a,b)=>a.key.localeCompare(b.key)||a.start-b.start);return {issues,hash:hashOf(r.type,f),at:now(),label:eff.label};};
proofCard=function(issue,cid,i,canApply,bulk){const options=issue.candidates||[{text:issue.to,reason:issue.reason}],attrs=`data-cid="${esc(cid)}" data-i="${i}" data-bulk="${bulk?1:0}"`;return `<div class="proof" tabindex="0" data-a="gotoIssue" ${attrs}><div class="pl">${esc(issue.key)} · ${esc(issue.src)}</div><div class="pw"><del>${esc(issue.from)}</del> → <ins>${esc(issue.applied?issue.appliedTo:options.map(x=>x.text).join(' / '))}</ins></div><div class="pr">교정 이유: ${esc(issue.reason)}</div><div class="pa">${issue.applied?`<button class="btn sm" data-a="restoreIssue" ${attrs} ${canApply?'':'disabled'}>복원</button>`:options.map((x,j)=>`<button class="btn sm" data-a="applyIssue" ${attrs} data-choice="${j}" ${canApply?'':'disabled'}>${options.length===1?'적용':esc(x.text)+' 선택'}</button>`).join('')}<button class="btn sm ghost" data-a="correctionSuggestion" ${attrs}>건의하기</button></div></div>`;};
vProof=function(tab,r,c,F,edit){const t=tab.st,eff=effectiveRules(r.type,P(r.pid).cid),allowed=x=>!(r.type==='자유입력형'&&getFiles(t,x).length),top=`<div class="row"><button class="btn sm" data-a="check" ${allowed(c)&&!eff.missing?'':'disabled'}>이 콘텐츠 검사</button>${r.contents.length>1?`<button class="btn sm" data-a="checkAll" ${eff.missing?'disabled':''}>전체 검사 ${r.contents.filter(allowed).length}건</button>`:''}</div><p class="small faint">와이어링크 문자열·정규표현식 데이터셋 · ${esc(eff.label)}${eff.missing?' · 배정 필요':''}<br>교정 실행은 검수 요청·완료 조건이 아닙니다.</p>`;if(!allowed(c))return top+'<div class="ro-box small">첨부파일이 있는 자유입력형은 교정 실행·결과가 비활성화되며 전체 검사에서 제외됩니다. 첨부파일을 모두 제거하면 다시 사용할 수 있습니다.</div>';const rows=t.bulk?t.bulk.res:[{cid:c.id,res:t.proof?.[c.id]}];return top+(t.bulk?'<button class="btn sm ghost" data-a="clearBulk">전체 결과 닫기</button>':'')+rows.map(row=>{const cc=r.contents.find(x=>x.id===row.cid);if(!cc)return '';if(!allowed(cc))return `<p>${esc(row.cid)} · 첨부파일로 제외</p>`;if(!row.res)return '<div class="empty">아직 검사하지 않았습니다.</div>';const stale=row.res.hash!==hashOf(r.type,getF(t,cc));return `<div class="lbl">${esc(cc.id)} · ${esc(cc.title)}</div><div class="stale" data-live="stale" style="${stale?'':'display:none'}">최신 내용과 불일치 · 문안, 변수 또는 연결값이 바뀌었습니다. 다시 검사하세요.</div>${row.res.issues.length?row.res.issues.map((issue,i)=>proofCard(issue,cc.id,i,canEditContent(r)&&!(cc.lockBy&&cc.lockBy!==S.me)&&!stale,!!t.bulk)).join(''):'<div class="empty">교정할 표현이 없습니다.</div>'}`;}).join('');};
function correctionContext(el){const {tab,r}=ctxEdit();if(!r||!canView(r))return null;const c=r.contents.find(x=>x.id===el.dataset.cid),res=el.dataset.bulk==='1'?tab.st.bulk?.res.find(x=>x.cid===c?.id)?.res:tab.st.proof?.[c?.id]||tab.st.bulk?.res.find(x=>x.cid===c?.id)?.res,issue=res?.issues[+el.dataset.i];if(!c||!issue||r.type==='자유입력형'&&getFiles(tab.st,c).length)return null;return {tab,r,c,res,issue};}
A.gotoIssue=el=>{const x=correctionContext(el);if(!x)return;const {tab,r,c,res,issue}=x;const destination=tab.route==='content'&&tab.p.cid!==c.id?openTab('content',{id:r.id,cid:c.id}):tab;if(!destination)return;destination.st.cid=c.id;destination.st.proof||={};destination.st.proof[c.id]=res;destination.st.sp='proof';render();focusIssue(issue.key,issue.start,issue.end);};
function replaceCorrection(el,undo){const x=correctionContext(el);if(!x)return;const {tab,r,c,res,issue}=x;if(!editable(r,c)||res.hash!==hashOf(r.type,getF(tab.st,c)))return toast('최신 내용과 불일치합니다. 다시 검사하세요');const before=undo?issue.appliedTo:issue.from,after=undo?issue.from:issue.candidates[+(el.dataset.choice||0)]?.text;if(typeof after!=='string'||!!issue.applied!==!!undo)return;const f=getF(tab.st,c),text=String(getPath(f,issue.key)||'');if(text.slice(issue.start,issue.end)!==before)return toast('해당 표현이 변경되었습니다. 다시 검사하세요');const m=mutF(tab,r,c);setPath(m.f,issue.key,text.slice(0,issue.start)+after+text.slice(issue.end));const delta=after.length-before.length,oldEnd=issue.end;res.issues.forEach(other=>{if(other!==issue&&other.key===issue.key&&other.start>=oldEnd){other.start+=delta;other.end+=delta;}});issue.end=issue.start+after.length;issue.applied=!undo;issue.appliedTo=undo?null:after;res.hash=hashOf(r.type,m.f);log(r,undo?'교정 복원':'교정 적용',`${c.id}: ${before} → ${after}`,c.id);if(m.auto)autosave(tab,c);render();}
A.applyIssue=el=>replaceCorrection(el,false);A.restoreIssue=el=>replaceCorrection(el,true);
A.correctionSuggestion=el=>{const x=correctionContext(el);if(!x)return;const {r,c,issue}=x;showModal({title:'교정 건의하기',body:()=>`<p>${esc(issue.from)} → ${esc(issue.candidates.map(x=>x.text).join(' / '))}</p>`+mTa('why','건의 이유','',1)+mIn('suggestion','제안 표현'),ok:'건의 저장',onOk:()=>{if(!canView(r)||!need(['why','건의 이유']))return false;S.correctionSuggestions||=[];S.correctionSuggestions.push({id:uid('sug'),request:r.id,content:c.id,original:issue.from,candidates:clone(issue.candidates),reason:M('why'),suggestion:M('suggestion'),by:S.me,at:now()});log(r,'교정 건의',`${c.id}: ${M('why')}`,c.id);persistSafe();toast('건의를 저장했습니다. 데이터셋 처리·배포 고도화는 Phase 2입니다');}});};
const liveBeforeCorrections=updateLive;updateLive=function(tab,r,c){liveBeforeCorrections(tab,r,c);const panel=$('.sp-body');if(panel&&tab.st.sp==='proof')panel.innerHTML=vProof(tab,r,c,getF(tab.st,c),editable(r,c));};

// Recheck approval eligibility independently of assignment data consistency.
function eligibleApprovers(r){return approvers(r.pid).filter(id=>U(id)?.active&&id!==r.by&&id!==r.primary&&!r.reviewers.includes(id));}
async function prototypeScan(file,outcome='safe'){
  if(outcome==='failed')throw new Error('검사 서비스 실패 시연: 등록할 수 없습니다');
  const sample=new TextDecoder().decode(await file.slice(0,4096).arrayBuffer());
  if(outcome==='unsafe'||sample.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')){const error=new Error('위험 파일 검사 결과: 등록할 수 없습니다');error.unsafe=true;throw error;}
  return 'prototype-safe';
}
const renderWithUpload=render;
render=function(){renderWithUpload();const tab=activeTab(),r=tab&&Rq(tab.p.id),main=$('#main');if(!main||!r||!canView(r)||!['request','content'].includes(tab.route))return;const st=tab.st;main.insertAdjacentHTML('beforeend',`<div class="panel" style="margin:16px"><div class="panel-b"><b>첨부 검사 시연</b><p class="small">실제 바이러스 검사는 서버 연동 대상입니다. 아래 결과는 화면 흐름 확인용입니다.</p>${canEditContent(r)?`<select class="sel" data-i="scanScenario" aria-label="첨부 검사 시연 결과"><option value="safe" ${st.scanOutcome==='safe'?'selected':''}>정상</option><option value="failed" ${st.scanOutcome==='failed'?'selected':''}>검사 실패</option><option value="unsafe" ${st.scanOutcome==='unsafe'?'selected':''}>위험 파일</option></select>`:''}<div role="status" aria-live="polite">${(st.uploads||[]).map(x=>`<p>${esc(x.name)} · ${esc(x.state)}${x.error?' · '+esc(x.error):''}</p>`).join('')}</div></div></div>`);};
IN.scanScenario=el=>{const {tab,r}=ctxEdit();if(r&&canEditContent(r))tab.st.scanOutcome=el.value;};
const allowedBeforeUpload=actionAllowed;
actionAllowed=function(name,el){const r=Rq(el?.dataset?.id)||Rq(activeTab()?.p?.id);if(r?.uploadBusy&&['submit','complete','approve','revise','rmFile','delC','saveRev'].includes(name))return false;return allowedBeforeUpload(name,el);};
can.approve=r=>!!r&&canView(r)&&r.status==='appr'&&eligibleApprovers(r).includes(S.me);
const completeWithEligibility=A.complete;
A.complete=el=>{const {r}=cur();if(r&&custOf(r).approval&&!eligibleApprovers(r).length){if(!can.complete(r)||!canView(r))return;notify(S.users.filter(u=>u.active&&(u.admin||[]).includes(P(r.pid).cid)).map(u=>u.id),'적격 승인자 지정 필요: '+r.title,r.id);notify([r.by,P(r.pid).lead],'적격 승인자 부재로 완료 지연: '+r.title,r.id);log(r,'승인 대기 전환 차단','적격 승인자 없음');persistSafe();return toast('적격 승인자가 없습니다. 관리자에게 승인자 지정을 요청했습니다');}return completeWithEligibility(el);};

// Explicit confirmation is bound to the email currently entered in the form.
for(const name of ['inviteUser','seedUser']){const start=A[name];A[name]=el=>{const result=start(el);const modal=UI.modal;if(!modal?.onOk)return result;const body=modal.body,commit=modal.onOk;let confirmedEmail='';modal.body=()=>body()+`<p class="small">외부 도메인 초대는 경고 확인 후 진행됩니다.</p>`;modal.onOk=()=>{const email=String(M('email')||'').trim().toLowerCase(),cid=el?.dataset?.cid||S.cid;if(email&&email.split('@')[1]!==String(Cu(cid)?.domain||'').toLowerCase()&&confirmedEmail!==email){confirmedEmail=email;toast('회사 도메인과 다른 이메일입니다. 주소를 확인한 뒤 초대 링크 생성을 다시 누르면 초대됩니다');return false;}return commit();};return result;};}

const validationBeforeUpload=validateReq;
validateReq=function(r){const result=validationBeforeUpload(r);if(r.uploadBusy)result.list.push('첨부파일 업로드·검사가 끝난 후 요청하세요');return result;};
S.requests.forEach(r=>r.uploadBusy=false);
const profileBeforePhasePolicy=vProfile;
vProfile=()=>profileBeforePhasePolicy().replace(/<div class="seg">[\s\S]*?data-a="theme"[\s\S]*?<\/div>/,'<p class="small">라이트/다크 테마 선택은 Phase 2입니다.</p>');
document.documentElement.dataset.theme='light';
render();
const guardBeforeUploading=actionAllowed;
actionAllowed=function(name,el){const r=Rq(el?.dataset?.id)||Rq(activeTab()?.p?.id);if(r?.uploadBusy&&['submit','complete','approve','revise','cancelReq','recallReq','recallDecide','assign','answer','saveRev','rmFile','delC','typeChange'].includes(name))return false;return guardBeforeUploading(name,el);};
