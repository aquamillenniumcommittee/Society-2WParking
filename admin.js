const { createClient }=window.supabase;
const supabase=createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
let timer=null;

function msg(t,ok=false){$('adminMsg').textContent=t;$('adminMsg').style.color=ok?'#166534':'#b91c1c';}
async function loadDashboard(){
  const {data:state,error:se}=await supabase.from('allocation_state').select('*').eq('id',1).single();
  if(se) throw se;
  const {data:members,error:me}=await supabase.from('members').select('selection_index,flat_number,pre_allocated_slot,selected_slot').order('selection_index');
  if(me) throw me;
  const {data:allocs,error:ae}=await supabase.from('allocations').select('id,selection_index,flat_number,slot_number,allocation_type,allocated_at').order('id',{ascending:false});
  if(ae) throw ae;
  const {data:slots,error:sle}=await supabase.from('parking_slots').select('slot_number,status').order('slot_number');
  if(sle) throw sle;
  $('adminLogin').classList.add('hidden');$('dashboard').classList.remove('hidden');
  $('dashCurrent').textContent=state.current_index ?? 'Done';
  $('dashAvailable').textContent=slots.filter(x=>x.status==='available').length;
  $('dashPaused').textContent=state.is_paused?'PAUSED':'LIVE';
  $('pauseBtn').textContent=state.is_paused?'Resume':'Pause';
  $('register').innerHTML=`<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:9px">Index</th><th style="text-align:left;padding:9px">Flat</th><th style="text-align:left;padding:9px">Slot</th><th style="text-align:left;padding:9px">Type</th><th style="text-align:left;padding:9px">Time</th></tr></thead><tbody>${
    allocs.map(a=>`<tr><td style="padding:9px;border-top:1px solid #eee">${a.selection_index}</td><td style="padding:9px;border-top:1px solid #eee">${a.flat_number}</td><td style="padding:9px;border-top:1px solid #eee">${a.slot_number}</td><td style="padding:9px;border-top:1px solid #eee">${a.allocation_type}</td><td style="padding:9px;border-top:1px solid #eee">${new Date(a.allocated_at).toLocaleString()}</td></tr>`).join('')
  }</tbody></table>`;
}
$('adminLoginForm').addEventListener('submit',async e=>{
 e.preventDefault();msg('Signing in…',true);
 const {error}=await supabase.auth.signInWithPassword({email:$('adminEmail').value,password:$('adminPassword').value});
 if(error){msg(error.message);return}
 await loadDashboard();
 timer=setInterval(()=>loadDashboard().catch(()=>{}),4000);
});
$('pauseBtn').onclick=async()=>{
 const {data:state}=await supabase.from('allocation_state').select('is_paused').eq('id',1).single();
 const {error}=await supabase.rpc('admin_set_paused',{p_paused:!state.is_paused});
 if(error) alert(error.message); else await loadDashboard();
};
$('undoBtn').onclick=async()=>{
 if(!confirm('Undo the most recent member selection?')) return;
 const {data,error}=await supabase.rpc('admin_undo_last');
 if(error) alert(error.message); else {alert(data.message);await loadDashboard();}
};
$('signoutBtn').onclick=async()=>{await supabase.auth.signOut();location.reload()};
(async()=>{const {data}=await supabase.auth.getSession();if(data.session){try{await loadDashboard()}catch(e){}}})();
