let supabaseClient = null;
let member = null;
let selectedPending = null;
let poller = null;

const $ = id => document.getElementById(id);

function normalizeCode(v){ return (v || '').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function showMsg(text, ok=false){ $('loginMsg').textContent=text; $('loginMsg').style.color=ok?'#166534':'#b91c1c'; }
function getClient(){
  if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase library did not load. Check your internet connection or try Chrome/Safari private browsing.');
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) throw new Error('Website configuration is missing.');
  if (!supabaseClient) supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return supabaseClient;
}

async function login(flat, code){
  const sb=getClient();
  const {data,error}=await sb.rpc('member_login',{p_flat:flat,p_code:normalizeCode(code)});
  if(error) throw new Error(`Database error: ${error.message}`);
  if(!data || !data.ok) throw new Error(data?.message || 'Invalid flat number or access code.');
  member={flat:data.flat,code:normalizeCode(code),...data};
  sessionStorage.setItem('parkingMember',JSON.stringify(member));
  renderMember(data);
  await refresh();
  startPolling();
}

function logout(){
  member=null; sessionStorage.removeItem('parkingMember');
  stopPolling(); $('memberArea').classList.add('hidden'); $('loginCard').classList.remove('hidden');
  $('code').value=''; $('loginMsg').textContent='';
}

function renderMember(d){
  $('loginCard').classList.add('hidden'); $('memberArea').classList.remove('hidden');
  $('memberFlat').textContent=d.flat;
  $('memberIndex').textContent=d.index;
  $('currentIndex').textContent=d.current_index ?? 'Done';
  $('availableCount').textContent=d.available_count;
  $('pausedBanner').classList.toggle('hidden',!d.paused);
  $('selectionBanner').classList.toggle('hidden',!d.is_current || d.paused);
  if(d.pre_allocated_slot || d.selected_slot){
    $('allocatedCard').classList.remove('hidden');
    $('mySlot').textContent=d.pre_allocated_slot || d.selected_slot;
    $('allocationText').textContent=d.pre_allocated_slot ? 'This flat has a pre-allocated parking slot.' : 'Your selected slot is locked and confirmed.';
  }else{
    $('allocatedCard').classList.add('hidden');
    if(d.paused) $('memberStatus').textContent='Please wait. Selection is paused.';
    else if(d.is_current) $('memberStatus').textContent='It is your turn — choose an available slot.';
    else if(d.current_index) $('memberStatus').textContent=`Please wait. Current turn is index ${d.current_index}.`;
    else $('memberStatus').textContent='All selections are complete.';
  }
}

async function refresh(){
  if(!member) return;
  const sb=getClient();
  const [statusRes,slotsRes]=await Promise.all([
    sb.rpc('member_login',{p_flat:member.flat,p_code:member.code}),
    sb.rpc('public_slots')
  ]);
  if(statusRes.error) throw new Error(`Status error: ${statusRes.error.message}`);
  if(slotsRes.error) throw new Error(`Slot board error: ${slotsRes.error.message}`);
  if(!statusRes.data?.ok) throw new Error(statusRes.data?.message || 'Could not read member status.');
  member={...member,...statusRes.data};
  renderMember(statusRes.data);
  renderSlots(slotsRes.data || []);
}

function renderSlots(slots){
  const canSelect=!!member && !!member.is_current && !member.paused && !member.selected_slot && !member.pre_allocated_slot;
  $('slotList').innerHTML='';
  slots.forEach(s=>{
    const div=document.createElement('button');
    div.className='slot '+s.status;
    div.type='button';
    div.disabled=!(s.status==='available' && canSelect);
    div.innerHTML=`${s.slot_number}<small>${s.status==='available'?'AVAILABLE':s.status==='preallocated'?'PRE-ALLOCATED':'ALLOCATED'}</small>`;
    if(!div.disabled) div.onclick=()=>openConfirm(s.slot_number);
    $('slotList').appendChild(div);
  });
}
function openConfirm(slot){ selectedPending=slot; $('confirmSlot').textContent=slot; $('agreeTerms').checked=false; $('confirmSelect').disabled=true; $('confirmModal').classList.remove('hidden'); }
function closeConfirm(){ selectedPending=null; $('agreeTerms').checked=false; $('confirmSelect').disabled=true; $('confirmModal').classList.add('hidden'); }

async function confirmSelection(){
  if(!selectedPending||!member) return;
  const btn=$('confirmSelect'); btn.disabled=true; btn.textContent='Allocating…';
  try{
    const sb=getClient();
    if(!$('agreeTerms').checked){ alert('Please tick the agreement checkbox before confirming the slot.'); return; }
    const {data,error}=await sb.rpc('select_parking_slot',{p_flat:member.flat,p_code:member.code,p_slot:selectedPending,p_agree:true});
    if(error) throw new Error(`Allocation error: ${error.message}`);
    if(!data?.ok) throw new Error(data?.message || 'Selection failed.');
    closeConfirm(); await refresh(); alert(`Allocation confirmed: ${data.slot}`);
  }catch(e){ alert(e.message || 'Could not complete allocation.'); }
  finally{btn.disabled=false;btn.textContent='Confirm allocation';}
}

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); showMsg('Connecting…',true);
  try{ await login($('flat').value.trim(),$('code').value.trim()); }
  catch(err){ showMsg(err.message || 'Could not log in.'); }
});
$('logoutBtn').onclick=logout;
$('cancelConfirm').onclick=closeConfirm;
$('confirmSelect').onclick=confirmSelection;
$('agreeTerms').addEventListener('change',()=>{ $('confirmSelect').disabled=!$('agreeTerms').checked; });
function startPolling(){stopPolling();poller=setInterval(()=>refresh().catch(err=>console.warn(err)),4000)}
function stopPolling(){if(poller){clearInterval(poller);poller=null}}

(async function init(){
  try{
    getClient();
    const saved=sessionStorage.getItem('parkingMember');
    if(saved){ member=JSON.parse(saved); renderMember(member); await refresh(); startPolling(); }
  }catch(e){ console.warn(e); }
})();
