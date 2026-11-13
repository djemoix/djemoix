'use strict';
const $ = (selector) => document.querySelector(selector);
const state = { alerts: [], cases: [], selected: null, mode: "demo" };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (value) => value ? new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : '—';
const badge = (value) => `<span class="badge ${esc(value)}">${esc(String(value).replaceAll('_',' '))}</span>`;
function toast(message, error=false){ const el=$('#toast'); el.textContent=message; el.className=`show${error?' error':''}`; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.className='',4000); }
async function request(url,options={}){
  const res=await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  let body; try{body=await res.json();}catch{body={detail:'Unexpected server response'};}
  if(!res.ok){throw new Error(typeof body.detail==='string'?body.detail:JSON.stringify(body.detail||body));}
  return body;
}
async function refresh(){
  try{
    const params=new URLSearchParams();
    if($('#severity').value) params.set('severity',$('#severity').value);
    if($('#status').value) params.set('status',$('#status').value);
    if($('#search').value.trim()) params.set('q',$('#search').value.trim());
    const [health,telemetry,summary,alerts,cases]=await Promise.all([
      request('/api/health'),request('/api/telemetry'),
      request('/api/summary'),request('/api/alerts?'+params),request('/api/incidents')
    ]);
    state.alerts=alerts; state.cases=cases; state.mode=health.mode;
    updateSourceStatus(health,telemetry);
    $('#count-total').textContent=summary.total_alerts;
    $('#count-active').textContent=summary.active_alerts;
    $('#count-high').textContent=summary.high_priority;
    $('#count-cases').textContent=summary.open_cases;
    renderAlerts(); renderCases(); renderInspector();
  }catch(err){toast(err.message,true);}
}
function updateSourceStatus(health,telemetry){
  const live=health.mode==='live';
  const active=telemetry.agents.filter(a=>a.online);
  $('#mode-pill').textContent=live?(active.length?'LIVE LINUX · AGENT ONLINE':'LIVE LINUX · AGENT OFFLINE'):'DEMO ENVIRONMENT';
  $('#notice-label').textContent=live?'REAL LOCAL JOURNAL TELEMETRY':'DEMO DATA ONLY';
  $('#notice-text').textContent=live?
    `${telemetry.events_24h} normalized Linux auth events in the last 24h; ${active.length} agent(s) online. Alert rules require repeated failures. Dashboard/analyst APIs have no login: localhost only.`:
    'Synthetic examples only. No SIEM/EDR is connected. Select live mode and run the Linux agent to ingest real journald auth events.';
  $('#agent-state').textContent=live?`${active.length}/${telemetry.agents.length} agents online · ${telemetry.events_24h} auth events / 24h`:'Local-first · Synthetic demo alerts';
  $('#open-alert').hidden=live;
}
function renderAlerts(){
  $('#alert-rows').innerHTML=state.alerts.length?state.alerts.map(a=>`<tr data-id="${a.id}" tabindex="0" class="${a.id===state.selected?'active':''}" aria-label="Inspect alert ${a.id}"><td><strong>${esc(a.title)}</strong><small>${esc(a.source)} · #${a.id}</small></td><td>${badge(a.severity)}</td><td>${badge(a.status)}</td><td>${esc(a.asset||'—')}</td><td>${esc(fmt(a.event_time))}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No matching alerts.</td></tr>';
  $('#alert-count').textContent=`Showing ${state.alerts.length} alert${state.alerts.length===1?'':'s'} · Maximum 100 per view`;
}
function renderInspector(){
  const a=state.alerts.find(x=>x.id===state.selected);
  if(!a){$('#inspector-body').innerHTML='<div class="empty">Choose an alert from the table to view details and start a case.</div>';return;}
  const options=['new','investigating','resolved','false_positive'].map(s=>`<option value="${s}" ${s===a.status?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('');
  $('#inspector-body').innerHTML=`<p class="eyebrow">ALERT #${a.id}</p><h3 class="detail-title">${esc(a.title)}</h3>${badge(a.severity)} ${badge(a.status)}<div class="detail-row"><span class="key">Origin</span><span>${esc(a.origin||'demo')}</span></div><div class="detail-row"><span class="key">Source</span><span>${esc(a.source)}</span></div><div class="detail-row"><span class="key">Asset</span><span>${esc(a.asset||'—')}</span></div><div class="detail-row"><span class="key">Source IP</span><span>${esc(a.src_ip||'—')}</span></div><div class="detail-row"><span class="key">Occurred</span><span>${esc(fmt(a.event_time))}</span></div><div class="detail-row"><span class="key">Case ID</span><span>${a.incident_id?'#'+a.incident_id:'Not assigned'}</span></div><p class="eyebrow" style="margin-top:20px">INVESTIGATION CONTEXT</p><p class="detail-text">${esc(a.details||'No context recorded')}</p><div class="inspector-actions"><label class="visually-hidden" for="new-alert-status">Change alert status</label><select id="new-alert-status">${options}</select><button class="btn subtle" id="save-alert-status">Update alert status</button><button class="btn primary" id="start-case" ${a.incident_id?'disabled':''}>${a.incident_id?'Already linked to a case':'+ Start investigation'}</button></div>`;
  $('#save-alert-status').addEventListener('click',async()=>{
    try{await request('/api/alerts/'+a.id,{method:'PATCH',body:JSON.stringify({status:$('#new-alert-status').value})});toast('Alert status updated');await refresh();}
    catch(err){toast(err.message,true);}
  });
  $('#start-case').addEventListener('click',()=>{
    const form=$('#new-case-form');form.reset();form.elements.alert_id.value=String(a.id);form.elements.title.value='Investigation: '+a.title;form.elements.severity.value=a.severity;$('#new-case-dialog').showModal();
  });
}
function renderCases(){
  $('#case-list').innerHTML=state.cases.length?state.cases.map(c=>`<button class="case-card" data-case="${c.id}"><div class="meta"><span>CASE #${c.id}</span>${badge(c.status)}</div><h3>${esc(c.title)}</h3><p>${esc(c.description||'No description')}${c.description?.length>120?'…':''}</p><div class="meta"><span>${badge(c.severity)}</span><span>${c.alert_count} linked alerts · ${esc(fmt(c.updated_at))}</span></div></button>`).join(''):'<div class="empty">No cases yet. Create a case from an alert.</div>';
}
$('#alert-rows').addEventListener('click',(e)=>{const row=e.target.closest('tr[data-id]');if(!row)return;state.selected=Number(row.dataset.id);renderAlerts();renderInspector();});
$('#alert-rows').addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){const row=e.target.closest('tr[data-id]');if(row){e.preventDefault();row.click();}}});
$('#case-list').addEventListener('click',(e)=>{const btn=e.target.closest('[data-case]');if(!btn)return;const c=state.cases.find(x=>x.id===Number(btn.dataset.case));if(!c)return;const form=$('#case-form');form.elements.case_id.value=c.id;form.elements.status.value=c.status;form.elements.notes.value=c.notes;$('#case-title').textContent=`#${c.id} · ${c.title}`;$('#case-dialog').showModal();});
$('#open-alert').addEventListener('click',()=>$('#new-alert-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
$('#new-alert-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));try{const alert=await request('/api/alerts',{method:'POST',body:JSON.stringify(values)});$('#new-alert-dialog').close();form.reset();state.selected=alert.id;toast('Alert created');await refresh();}catch(err){toast(err.message,true);}});
$('#new-case-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));try{await request('/api/incidents',{method:'POST',body:JSON.stringify({title:values.title,severity:values.severity,description:values.description,alert_ids:[Number(values.alert_id)]})});$('#new-case-dialog').close();toast('Investigation case created');await refresh();}catch(err){toast(err.message,true);}});
$('#case-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form));try{await request('/api/incidents/'+values.case_id,{method:'PATCH',body:JSON.stringify({status:values.status,notes:values.notes})});$('#case-dialog').close();toast('Case updated');await refresh();}catch(err){toast(err.message,true);}});
let debounce;['search','severity','status'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',()=>{clearTimeout(debounce);debounce=setTimeout(refresh,200);}));
$('#refresh').addEventListener('click',refresh);
refresh();
setInterval(()=>{if(state.mode==='live' && document.visibilityState!=='hidden') refresh();},20000);
