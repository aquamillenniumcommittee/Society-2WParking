
let consentClient = null;
let consentRecords = [];

const $ = id => document.getElementById(id);

function consentGetClient() {
  if (!window.supabase?.createClient) {
    throw new Error('Supabase library did not load. Please refresh the page.');
  }
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    throw new Error('Website configuration is missing.');
  }
  if (!consentClient) {
    consentClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }
  return consentClient;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function consentDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function consentTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

function showConsentMessage(message, success = false) {
  $('consentDashboardMsg').textContent = message;
  $('consentDashboardMsg').style.color =
    success ? '#166534' : '#b91c1c';
}

function renderConsentRows() {
  const search = $('consentSearch').value.trim().toLowerCase();
  const filter = $('consentFilter').value;

  const filtered = consentRecords.filter(record => {
    const accepted = record.agreement_accepted === true;
    const matchesSearch =
      String(record.flat_number ?? '').toLowerCase().includes(search) ||
      String(record.slot_number ?? '').toLowerCase().includes(search);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'yes' && accepted) ||
      (filter === 'no' && !accepted);

    return matchesSearch && matchesFilter;
  });

  $('consentCount').textContent =
    `Showing ${filtered.length} of ${consentRecords.length} members`;

  if (!filtered.length) {
    $('consentRows').innerHTML =
      '<tr><td colspan="6">No matching members found.</td></tr>';
    return;
  }

  $('consentRows').innerHTML = filtered.map(record => {
    const accepted = record.agreement_accepted === true;
    return `<tr>
      <td>${escapeHtml(record.flat_number)}</td>
      <td>${escapeHtml(record.slot_number)}</td>
      <td class="${accepted ? 'status-yes' : 'status-no'}">
        ${accepted ? 'Consent received' : 'Pending'}
      </td>
      <td>${accepted ? consentDate(record.agreed_at) : '—'}</td>
      <td>${accepted ? consentTime(record.agreed_at) : '—'}</td>
      <td>${accepted ? escapeHtml(record.terms_version || '—') : '—'}</td>
    </tr>`;
  }).join('');
}

async function loadConsentRegister() {
  const sb = consentGetClient();
  showConsentMessage('Loading consent register…', true);

  const { data, error } = await sb.rpc('get_preallocated_consent_admin');

  if (error) {
    throw new Error(error.message);
  }
  if (!data || !Array.isArray(data.records)) {
    throw new Error('The server returned an unexpected response.');
  }

  consentRecords = data.records;

  $('consentTotal').textContent = data.total_preallocated ?? 0;
  $('consentAccepted').textContent = data.consented ?? 0;
  $('consentPending').textContent = data.pending ?? 0;

  $('consentLogin').classList.add('hidden');
  $('consentDashboard').classList.remove('hidden');

  renderConsentRows();
  showConsentMessage('Consent register updated successfully.', true);
}

$('consentLoginForm').addEventListener('submit', async event => {
  event.preventDefault();

  try {
    $('consentMsg').textContent = 'Signing in…';

    const sb = consentGetClient();
    const { error } = await sb.auth.signInWithPassword({
      email: $('consentEmail').value.trim(),
      password: $('consentPassword').value
    });

    if (error) throw new Error(error.message);

    await loadConsentRegister();
  } catch (error) {
    $('consentMsg').textContent =
      `Could not load the consent register: ${error.message}`;
  }
});

$('refreshConsent').addEventListener('click', async () => {
  try {
    await loadConsentRegister();
  } catch (error) {
    showConsentMessage(error.message);
  }
});

$('consentSearch').addEventListener('input', renderConsentRows);
$('consentFilter').addEventListener('change', renderConsentRows);

$('exportConsent').addEventListener('click', () => {
  const search = $('consentSearch').value.trim().toLowerCase();
  const filter = $('consentFilter').value;

  const filtered = consentRecords.filter(record => {
    const accepted = record.agreement_accepted === true;
    const matchesSearch =
      String(record.flat_number ?? '').toLowerCase().includes(search) ||
      String(record.slot_number ?? '').toLowerCase().includes(search);

    return matchesSearch &&
      (filter === 'all' ||
       (filter === 'yes' && accepted) ||
       (filter === 'no' && !accepted));
  });

  const headers = [
    'Flat number', 'Preallocated slot', 'Consent status',
    'Date (IST)', 'Time (IST)', 'Terms version'
  ];

  const csvCell = value =>
    '"' + String(value ?? '').replace(/"/g, '""') + '"';

  const lines = [
    headers,
    ...filtered.map(record => {
      const accepted = record.agreement_accepted === true;
      return [
        record.flat_number,
        record.slot_number,
        accepted ? 'Consent received' : 'Pending',
        accepted ? consentDate(record.agreed_at) : '',
        accepted ? consentTime(record.agreed_at) : '',
        accepted ? record.terms_version : ''
      ];
    })
  ];

  const csv = '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'preallocated-consent-register.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

$('consentSignout').addEventListener('click', async () => {
  try {
    await consentGetClient().auth.signOut();
  } finally {
    window.location.reload();
  }
});

(async () => {
  try {
    const sb = consentGetClient();
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    if (data.session) {
      await loadConsentRegister();
    }
  } catch (error) {
    $('consentMsg').textContent = error.message;
  }
})();
