const STORAGE_KEY = 'campusCourierPackages_v1';
const form = document.getElementById('packageForm');
const verifyForm = document.getElementById('verifyForm');
const tableBody = document.getElementById('packageTableBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const blockFilter = document.getElementById('blockFilter');
const emptyState = document.getElementById('emptyState');
const toast = document.getElementById('toast');
let packages = loadPackages();
let latestToken = '';
let toastTimer;

const blocks = [...Array.from({length:7},(_,i)=>`BH-${i+1}`), ...Array.from({length:7},(_,i)=>`GH-${i+1}`)];
blocks.forEach(block => {
  document.getElementById('hostelBlock').add(new Option(block, block));
  blockFilter.add(new Option(block, block));
});

document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date());
document.getElementById('year').textContent = new Date().getFullYear();

function loadPackages(){
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(saved) ? saved : []; }
  catch { return []; }
}
function savePackages(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(packages)); }
function escapeHTML(value){ return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function createToken(){
  let token;
  const used = new Set(packages.map(item => item.token));
  do { token = String(Math.floor(1000 + Math.random()*9000)); } while(used.has(token));
  return token;
}
function showToast(message){
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>toast.classList.remove('show'),2600);
}
function formatDate(value){ return new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); }
function updateStats(){
  const pending = packages.filter(p=>p.status==='Pending').length;
  const delivered = packages.length-pending;
  document.getElementById('totalCount').textContent = packages.length;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('deliveredCount').textContent = delivered;
  document.getElementById('blockCount').textContent = new Set(packages.map(p=>p.hostel)).size;
  document.getElementById('recordCount').textContent = `${packages.length} RECORD${packages.length===1?'':'S'}`;
}
function renderPackages(){
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const block = blockFilter.value;
  const filtered = packages.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(query) || p.roll.toLowerCase().includes(query);
    return matchesSearch && (status==='all' || p.status===status) && (block==='all' || p.hostel===block);
  }).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  tableBody.innerHTML = filtered.map(p=>`<tr>
    <td class="student-cell"><strong>${escapeHTML(p.name)}</strong><small>Roll no. ${escapeHTML(p.roll)}</small></td>
    <td><span class="hostel-tag">${escapeHTML(p.hostel)}</span></td>
    <td>${escapeHTML(p.courier)}</td>
    <td>•••• ${escapeHTML(p.tracking)}</td>
    <td><span class="status ${p.status.toLowerCase()}">${p.status}</span></td>
    <td>${formatDate(p.createdAt)}</td>
  </tr>`).join('');
  emptyState.classList.toggle('hidden', filtered.length>0);
  document.getElementById('showingText').textContent = `Showing ${filtered.length} of ${packages.length} package${packages.length===1?'':'s'}`;
  updateStats();
}

form.addEventListener('submit', event=>{
  event.preventDefault();
  if(!form.reportValidity()) return;
  const name = document.getElementById('studentName').value.trim().replace(/\s+/g,' ');
  const roll = document.getElementById('rollNumber').value.trim();
  const hostel = document.getElementById('hostelBlock').value;
  const courier = document.getElementById('courierCompany').value;
  const tracking = document.getElementById('trackingDigits').value.trim();
  if(!name || !roll || !/^\d{4}$/.test(tracking)){ showToast('Please check all package details.'); return; }
  const token = createToken();
  packages.push({id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),name,roll,hostel,courier,tracking,token,status:'Pending',createdAt:new Date().toISOString(),deliveredAt:null});
  savePackages(); renderPackages();
  latestToken = token;
  document.getElementById('generatedToken').textContent = token;
  document.getElementById('tokenResult').classList.remove('hidden');
  form.reset();
  showToast('Package registered. Pickup token generated.');
});

document.getElementById('copyTokenBtn').addEventListener('click', async()=>{
  if(!latestToken) return;
  try { await navigator.clipboard.writeText(latestToken); showToast('Pickup token copied.'); }
  catch { showToast(`Pickup token: ${latestToken}`); }
});

verifyForm.addEventListener('submit', event=>{
  event.preventDefault();
  const token = document.getElementById('pickupToken').value.trim();
  const message = document.getElementById('verifyMessage');
  const match = packages.find(p=>p.token===token);
  message.className = 'message';
  if(!/^\d{4}$/.test(token)){
    message.textContent = 'Enter a valid 4-digit collection token.'; message.classList.add('error');
  } else if(!match){
    message.textContent = 'Token not found. Check the digits and try again.'; message.classList.add('error');
  } else if(match.status==='Delivered'){
    message.textContent = `This package was already collected by ${match.name} (${match.roll}).`; message.classList.add('error');
  } else {
    match.status='Delivered'; match.deliveredAt=new Date().toISOString(); savePackages(); renderPackages();
    message.textContent = `Verified! ${match.name} · Roll ${match.roll} · ${match.hostel}. Package marked as Delivered.`; message.classList.add('success');
    showToast('Pickup verified. Package marked delivered.');
  }
  message.classList.remove('hidden'); verifyForm.reset();
});

[searchInput,statusFilter,blockFilter].forEach(control=>control.addEventListener(control===searchInput?'input':'change',renderPackages));

document.getElementById('exportBtn').addEventListener('click',()=>{
  if(!packages.length){showToast('There are no package records to export.');return;}
  const columns = ['Student Name','Roll Number','Hostel Block','Courier Company','Tracking Last 4 Digits','Collection Token','Status','Date Logged','Date Delivered'];
  const rows = packages.map(p=>[p.name,p.roll,p.hostel,p.courier,p.tracking,p.token,p.status,formatDate(p.createdAt),p.deliveredAt?formatDate(p.deliveredAt):'']);
  const csv = [columns,...rows].map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href=url; link.download='campus-courier-records.csv'; link.click(); URL.revokeObjectURL(url);
  showToast('Package records exported as CSV.');
});

renderPackages();
