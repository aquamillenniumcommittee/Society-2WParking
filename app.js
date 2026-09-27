const { createClient } = window.supabase;
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
let member = null;
let selectedPending = null;
let poller = null;

function normalizeCode(v){ return (v || '').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function showMsg(text, ok=false){ $('loginMsg').textContent=text; $('loginMsg').style.color=ok?'#166534':'#b91c1c'; }

async function login(flat, code){
  const {data,error}=await supabase.rpc('member_login',{p_flat:flat,p_code:normalizeCode(code)});
  if(error) throw error;
  if(!data.ok) throw new Error(data.message);
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
    $('allocationText').textContent=d.pre_allocated_slot
      ? 'This flat has a pre-allocated parking slot.'
      : 'Your selected slot is locked and confirmed.';
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
  const [statusRes,slotsRes]=await Promise.all([
    supabase.rpc('member_login',{p_flat:member.flat,p_code:member.code}),
    supabase.rpc('public_slots')
  ]);
  if(statusRes.error) throw statusRes.error;
  if(!statusRes.data.ok) throw new Error(statusRes.data.message);
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

function openConfirm(slot){
  selectedPending=slot;
  $('confirmSlot').textContent=slot;
  $('confirmModal').classList.remove('hidden');
}
function closeConfirm(){selectedPending=null;$('confirmModal').classList.add('hidden');}

async function confirmSelection(){
  if(!selectedPending||!member) return;
  const btn=$('confirmSelect'); btn.disabled=true; btn.textContent='Allocating…';
  try{
    const {data,error}=await supabase.rpc('select_parking_slot',{p_flat:member.flat,p_code:member.code,p_slot:selectedPending});
    if(error) throw error;
    if(!data.ok){ alert(data.message || 'Selection failed.'); return; }
    closeConfirm();
    await refresh();
    alert(`Allocation confirmed: ${data.slot}`);
  }catch(e){ alert(e.message || 'Could not complete allocation.'); }
  finally{btn.disabled=false;btn.textContent='Confirm allocation';}
}

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); showMsg('Opening…',true);
  try{ await login($('flat').value.trim(),$('code').value.trim()); }
  catch(err){ showMsg(err.message || 'Could not log in.'); }
});
$('logoutBtn').onclick=logout;
$('cancelConfirm').onclick=closeConfirm;
$('confirmSelect').onclick=confirmSelection;

function startPolling(){stopPolling();poller=setInterval(()=>refresh().catch(()=>{}),4000)}
function stopPolling(){if(poller){clearInterval(poller);poller=null}}

(async function init(){
  if(!window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR-PROJECT')) return;
  const saved=sessionStorage.getItem('parkingMember');
  if(saved){ try{ member=JSON.parse(saved); renderMember(member); await refresh(); startPolling(); }catch(e){ logout(); } }
})();
