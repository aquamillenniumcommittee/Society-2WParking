
let supabaseClient = null;
let timer = null;

const $ = id => document.getElementById(id);

function formatISTDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function formatISTTime(value) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(value));
}

function msg(t, ok = false) {
  $('adminMsg').textContent = t;
  $('adminMsg').style.color = ok ? '#166534' : '#b91c1c';
}

function getClient() {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error(
      'Supabase library did not load. Check your internet connection or try Chrome/Safari private browsing.'
    );
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    throw new Error('Website configuration is missing.');
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }

  return supabaseClient;
}

async function loadDashboard() {
  const sb = getClient();

  const { data: state, error: se } = await sb
    .from('allocation_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (se) {
    throw new Error(`Dashboard database error: ${se.message}`);
  }

  const { data: members, error: me } = await sb
    .from('members')
    .select('selection_index,flat_number,pre_allocated_slot,selected_slot')
    .order('selection_index');

  if (me) {
    throw new Error(`Members access error: ${me.message}`);
  }

  const { data: allocs, error: ae } = await sb
    .from('allocations')
    .select('id,selection_index,flat_number,slot_number,allocation_type,allocated_at')
    .order('id', { ascending: false });

  if (ae) {
    throw new Error(`Allocation register error: ${ae.message}`);
  }

  const { data: slots, error: sle } = await sb
    .from('parking_slots')
    .select('slot_number,status')
    .order('slot_number');

  if (sle) {
    throw new Error(`Slot access error: ${sle.message}`);
  }

  $('adminLogin').classList.add('hidden');
  $('dashboard').classList.remove('hidden');

  $('dashCurrent').textContent = state.current_index ?? 'Done';

  $('dashAvailable').textContent =
    slots.filter(x => x.status === 'available').length;

  $('dashPaused').textContent = state.is_paused ? 'PAUSED' : 'LIVE';
  $('pauseBtn').textContent = state.is_paused ? 'Resume' : 'Pause';

  $('register').innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;padding:9px">Index</th>
          <th style="text-align:left;padding:9px">Flat</th>
          <th style="text-align:left;padding:9px">Slot</th>
          <th style="text-align:left;padding:9px">Type</th>
          <th style="text-align:left;padding:9px">Date</th>
          <th style="text-align:left;padding:9px">Time</th>
        </tr>
      </thead>
      <tbody>
        ${allocs.map(a => `
          <tr>
            <td style="padding:9px;border-top:1px solid #eee">${a.selection_index}</td>
            <td style="padding:9px;border-top:1px solid #eee">${a.flat_number}</td>
            <td style="padding:9px;border-top:1px solid #eee">${a.slot_number}</td>
            <td style="padding:9px;border-top:1px solid #eee">${a.allocation_type}</td>
            <td style="padding:9px;border-top:1px solid #eee">${formatISTDate(a.allocated_at)}</td>
            <td style="padding:9px;border-top:1px solid #eee">${formatISTTime(a.allocated_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* =========================================
   EXPORT ALLOCATION REGISTER TO CSV
   Read-only: does not change database data.
   ========================================= */

async function exportAllocationsCSV() {
  try {
    const sb = getClient();

    const { data: allocs, error } = await sb
      .from('allocations')
      .select(
        'selection_index,flat_number,slot_number,allocation_type,allocated_at'
      )
      .order('id', { ascending: false });

    if (error) {
      throw new Error(`CSV export failed: ${error.message}`);
    }

    if (!allocs || allocs.length === 0) {
      alert('There are no allocation records to export.');
      return;
    }

    const headers = [
      'Selection Index',
      'Flat Number',
      'Parking Slot',
      'Allocation Type',
      'Date (IST)',
      'Time (IST)'
    ];

    // Escape CSV values and protect spreadsheet software
    // from treating text values as formulas.
    const csvEscape = value => {
      let text = String(value ?? '');

      if (/^[\s]*[=+\-@]/.test(text)) {
        text = "'" + text;
      }

      return '"' + text.replace(/"/g, '""') + '"';
    };

    const rows = allocs.map(a => [
      a.selection_index,
      a.flat_number,
      a.slot_number,
      a.allocation_type,
      formatISTDate(a.allocated_at),
      formatISTTime(a.allocated_at)
    ]);

    const csv = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(csvEscape).join(','))
      .join('\r\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `parking-allocation-register-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Allow the browser time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (err) {
    alert(err.message || 'Could not export the allocation register.');
  }
}

/* =========================================
   ADMIN SIGN-IN
   ========================================= */

$('adminLoginForm').addEventListener('submit', async e => {
  e.preventDefault();

  try {
    msg('Signing in…', true);

    const sb = getClient();

    const { error } = await sb.auth.signInWithPassword({
      email: $('adminEmail').value.trim(),
      password: $('adminPassword').value
    });

    if (error) {
      throw new Error(`Sign-in error: ${error.message}`);
    }

    await loadDashboard();

  } catch (err) {
    msg(err.message || 'Could not sign in.');
  }
});

/* =========================================
   PAUSE / RESUME SELECTION
   ========================================= */

$('pauseBtn').onclick = async () => {
  try {
    const sb = getClient();

    const { data: state, error: se } = await sb
      .from('allocation_state')
      .select('is_paused')
      .eq('id', 1)
      .single();

    if (se) throw se;

    const { data, error } = await sb.rpc(
      'admin_set_paused',
      { p_paused: !state.is_paused }
    );

    if (error) throw error;

    await loadDashboard();

  } catch (e) {
    alert(e.message);
  }
};

/* =========================================
   UNDO MOST RECENT SELECTION
   ========================================= */

$('undoBtn').onclick = async () => {
  if (!confirm('Undo the most recent member selection?')) {
    return;
  }

  try {
    const sb = getClient();

    const { data, error } = await sb.rpc('admin_undo_last');

    if (error) throw error;

    alert(data.message);
    await loadDashboard();

  } catch (e) {
    alert(e.message);
  }
};

/* =========================================
   SIGN OUT
   ========================================= */

$('signoutBtn').onclick = async () => {
  await getClient().auth.signOut();
  location.reload();
};

/* =========================================
   CONNECT EXPORT CSV BUTTON
   ========================================= */

$('exportAllocations').addEventListener(
  'click',
  exportAllocationsCSV
);

/* =========================================
   RESTORE EXISTING ADMIN SESSION
   ========================================= */

(async () => {
  try {
    const sb = getClient();
    const { data } = await sb.auth.getSession();

    if (data.session) {
      await loadDashboard();
    }

  } catch (e) {
    msg(e.message);
  }
})();
