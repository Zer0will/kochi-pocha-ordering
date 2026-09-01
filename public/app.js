const state = {
  menu: null,
  selected: null,
  qty: 1,
  activeGuest: 'J',
  splitMode: 'even',
  round: Number(localStorage.getItem('kochi_round') || '1'),
  cart: JSON.parse(localStorage.getItem('kochi_cart') || '[]'),
  sentRounds: JSON.parse(localStorage.getItem('kochi_sent_rounds') || '[]')
};

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const slug = (s) => `cat-${s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-')}`;
const CATEGORY_KR = {'Special Combo':'콤보', Appetizers:'안주', Chicken:'치킨', Grilled:'구이', Entrees:'식사', Soup:'탕', Dessert:'후식', Beverage:'음료', Extras:'추가', 'Happy Hour':'해피'};
const tableId = decodeURIComponent(location.pathname.match(/\/table\/([^/?#]+)/)?.[1] || new URLSearchParams(location.search).get('table') || '7');
const categoryKr = (category) => category.korean || CATEGORY_KR[category.name] || category.name.slice(0, 2);
const shortEn = (name) => name.replace('Special Combo', 'COMBO').replace('Appetizers', 'APPETIZER').replace('Beverage', 'DRINKS').replace('Happy Hour', 'HAPPY');

function applyTableContext(){
  $('tableNumber').textContent = tableId;
  document.querySelectorAll('[data-table-label]').forEach(el => el.textContent = tableId);
  document.querySelector('[name="customerName"]').value = `Table ${tableId}`;
  updateRoundLabels();
}
function updateRoundLabels(){
  $('roundNumber').textContent = state.round;
  document.querySelectorAll('[data-round-label]').forEach(el => el.textContent = state.round);
}

async function loadMenu(){
  try{
    const res = await fetch('/data/menu.json');
    if(!res.ok) throw new Error('Menu failed to load');
    state.menu = await res.json();
    renderMenu(); renderCart(); applyTableContext();
  }catch(err){
    $('menuContent').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderMenu(filter=''){
  const q = filter.trim().toLowerCase();
  $('categoryRail').innerHTML = '';
  $('menuContent').innerHTML = '';
  let sections = 0;
  state.menu.categories.forEach((category, index) => {
    const matches = category.items.filter(item => !q || `${category.name} ${category.korean||''} ${item.name} ${item.korean||''} ${item.description||''}`.toLowerCase().includes(q));
    if(!matches.length) return;
    sections++;
    const btn = document.createElement('button');
    btn.className = `cat-btn ${index === 0 && !q ? 'active' : ''}`;
    btn.type = 'button'; btn.dataset.cat = category.name;
    btn.innerHTML = `<span class="cat-kr">${categoryKr(category)}</span><span class="cat-en">${shortEn(category.name)}</span>`;
    btn.onclick = () => document.getElementById(slug(category.name)).scrollIntoView({behavior:'smooth', block:'start'});
    $('categoryRail').appendChild(btn);

    const sec = document.createElement('section');
    sec.className = 'menu-section'; sec.id = slug(category.name);
    sec.innerHTML = `<div class="section-title"><h3>${shortEn(category.name)}</h3><span class="kr">${categoryKr(category)}</span><small>${matches.length} items</small></div><div class="item-grid"></div>`;
    const grid = sec.querySelector('.item-grid');
    matches.forEach(item => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = `menu-card ${item.featured ? 'featured' : ''}`;
      const price = item.price > 0 ? money(item.price) : 'Ask';
      card.innerHTML = `<div class="menu-art"><span>${item.korean || categoryKr(category)}</span>${item.badge ? `<b>${item.badge}</b>` : ''}</div><div class="menu-card-body"><h4>${item.name}</h4><p>${item.description || 'Ask your server.'}</p><footer><span>${price}</span><i>+</i></footer></div>`;
      card.onclick = () => openItem(category.name, item);
      grid.appendChild(card);
    });
    $('menuContent').appendChild(sec);
  });
  if(!sections) $('menuContent').innerHTML = `<div class="empty-state">No matching menu items.<br><span>다시 검색해보세요.</span></div>`;
  observeSections();
}

let observer;
function observeSections(){
  if(observer) observer.disconnect();
  observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible) return;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btn = [...document.querySelectorAll('.cat-btn')].find(b => slug(b.dataset.cat || '') === visible.target.id);
    if(btn) btn.classList.add('active');
  }, {root:$('menuContent'), rootMargin:'-10px 0px -62% 0px', threshold:[0,.2,.5]});
  document.querySelectorAll('.menu-section').forEach(s => observer.observe(s));
}

function openItem(category, item){
  if(item.price <= 0) return;
  state.selected = {category, item}; state.qty = 1;
  $('modalCategory').textContent = category;
  $('modalName').textContent = item.korean ? `${item.name} · ${item.korean}` : item.name;
  $('modalKorean').textContent = item.korean || categoryKr({name:category});
  $('modalDesc').textContent = item.description || 'Ask your server for details.';
  $('modalPrice').textContent = money(item.price);
  $('itemGuest').value = state.activeGuest || 'Shared table';
  $('itemNotes').value = '';
  updateModalTotal();
  openLayer('itemModal');
}
function updateModalTotal(){
  if(!state.selected) return;
  $('qtyValue').textContent = state.qty;
  $('addTotal').textContent = money(state.selected.item.price * state.qty);
}
function saveCart(){ localStorage.setItem('kochi_cart', JSON.stringify(state.cart)); }
function saveRounds(){ localStorage.setItem('kochi_sent_rounds', JSON.stringify(state.sentRounds)); localStorage.setItem('kochi_round', String(state.round)); }
function addSelected(){
  const note = $('itemNotes').value.trim();
  const guest = $('itemGuest').value;
  const {category, item} = state.selected;
  state.cart.push({id: crypto.randomUUID(), round: state.round, guest, category, name:item.name, korean:item.korean||'', price:item.price, qty:state.qty, note});
  closeLayer('itemModal'); saveCart(); renderCart(); openCart();
}
function totals(lines = [...state.sentRounds.flatMap(r => r.items), ...state.cart]){
  const subtotal = lines.reduce((s,l)=>s + Number(l.price||0)*Number(l.qty||0), 0);
  const tax = subtotal * (state.menu?.business?.taxRate ?? .1025);
  return { subtotal, tax, total: subtotal + tax, count: lines.reduce((s,l)=>s+Number(l.qty||0),0) };
}
function renderCart(){
  const items = $('cartItems'); items.innerHTML = '';
  $('emptyCart').hidden = !!state.cart.length;
  state.cart.forEach((line, idx) => {
    const el = document.createElement('div'); el.className = 'cart-line';
    el.innerHTML = `<div class="cart-line-top"><div><em>${line.guest}</em><h4>${line.name}${line.korean ? ` · ${line.korean}` : ''}</h4>${line.note ? `<small>${line.note}</small>` : ''}</div><b>${money(line.price*line.qty)}</b></div><div class="line-actions"><div class="qty-mini"><button data-act="minus" data-i="${idx}" type="button">−</button><span>${line.qty}</span><button data-act="plus" data-i="${idx}" type="button">+</button></div><button class="remove" data-act="remove" data-i="${idx}" type="button">Remove</button></div>`;
    items.appendChild(el);
  });
  items.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    const i = Number(btn.dataset.i), act = btn.dataset.act;
    if(act === 'plus') state.cart[i].qty++;
    if(act === 'minus') state.cart[i].qty = Math.max(1, state.cart[i].qty - 1);
    if(act === 'remove') state.cart.splice(i, 1);
    saveCart(); renderCart();
  });
  renderSentRounds();
  const current = totals(state.cart);
  const table = totals();
  $('subtotal').textContent = money(table.subtotal); $('tax').textContent = money(table.tax); $('total').textContent = money(table.total);
  $('mobileCount').textContent = current.count; $('mobileTotal').textContent = money(table.total);
  $('cartSubtitle').textContent = current.count ? 'Review round before sending' : `${state.sentRounds.length} sent rounds on bill`;
  $('mobileCartBtn').classList.toggle('has-items', current.count > 0 || state.sentRounds.length > 0);
  $('mobileCartBtn').setAttribute('aria-hidden', current.count > 0 || state.sentRounds.length > 0 ? 'false' : 'true');
  $('checkoutBtn').disabled = !state.cart.length;
  renderSplit();
}
function renderSentRounds(){
  const wrap = $('sentRounds'); wrap.innerHTML = '';
  wrap.hidden = !state.sentRounds.length;
  state.sentRounds.forEach(round => {
    const t = totals(round.items);
    const div = document.createElement('div'); div.className = 'sent-round';
    div.innerHTML = `<b>Round ${round.round}</b><span>${round.items.length} lines · ${money(t.subtotal)} · ${round.orderId || 'queued'}</span>`;
    wrap.appendChild(div);
  });
}
async function submitOrder(e){
  e.preventDefault();
  if(!state.cart.length) return;
  const form = e.currentTarget;
  const fd = new FormData(form);
  const t = totals(state.cart);
  $('orderStatus').className = ''; $('orderStatus').textContent = 'Sending round preview…';
  try{
    const res = await fetch('/api/order', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({customer:Object.fromEntries(fd.entries()), items:state.cart, totals:t, table:tableId, round:state.round, source:'kochi-table-qr-preview'})});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Order failed');
    state.sentRounds.push({round: state.round, orderId: data.orderId, sentAt: new Date().toISOString(), items: state.cart});
    state.cart = []; state.round += 1;
    saveCart(); saveRounds(); updateRoundLabels(); renderCart(); form.reset(); applyTableContext();
    $('orderStatus').className = 'success'; $('orderStatus').textContent = `Round sent: ${data.orderId}. Add another round or close out.`;
  }catch(err){ $('orderStatus').className = 'error'; $('orderStatus').textContent = err.message || 'Could not send round.'; }
}
function renderSplit(){
  if(!state.menu) return;
  const t = totals();
  $('billTotal').textContent = money(t.total);
  $('customKeypad').hidden = state.splitMode !== 'custom';
  const content = $('splitContent');
  if(!t.count){ content.innerHTML = `<div class="empty-state compact">No sent or unsent items yet.</div>`; return; }
  if(state.splitMode === 'even'){
    const per = t.total / 4;
    content.innerHTML = `<div class="split-list">${['J','S','M','Y'].map(g=>`<button type="button"><span>${g}</span><b>${money(per)}</b></button>`).join('')}</div>`;
  } else if(state.splitMode === 'seat'){
    const lines = [...state.sentRounds.flatMap(r=>r.items), ...state.cart];
    content.innerHTML = `<div class="split-list">${['Shared table','J','S','M','Y'].map(g=>{const gt=totals(lines.filter(l=>l.guest===g)); return `<button type="button"><span>${g}</span><b>${money(gt.total)}</b></button>`}).join('')}</div>`;
  } else {
    const paid = Number($('customAmount').dataset.value || '0');
    content.innerHTML = `<div class="custom-due"><span>Remaining after custom payment</span><b>${money(Math.max(0, t.total - paid))}</b></div>`;
  }
}
function openBill(){ renderSplit(); openLayer('billSheet'); }
function markPaid(){
  const t = totals();
  const modeLabel = state.splitMode === 'custom' ? `custom payment ${$('customAmount').value || '$0.00'}` : `${state.splitMode} split`;
  $('paidSummary').textContent = `${money(t.total)} closed in preview via ${modeLabel}. 감사합니다.`;
  state.cart = []; state.sentRounds = []; state.round = 1;
  saveCart(); saveRounds(); updateRoundLabels(); renderCart();
  closeLayer('billSheet'); closeCart(); openLayer('paidState');
}
function openLayer(id){ $(id).classList.add('open'); $(id).setAttribute('aria-hidden','false'); }
function closeLayer(id){ $(id).classList.remove('open'); $(id).setAttribute('aria-hidden','true'); }
function openCart(){ $('cartPanel').classList.add('open'); $('cartPanel').setAttribute('aria-hidden','false'); }
function closeCart(){ $('cartPanel').classList.remove('open'); $('cartPanel').setAttribute('aria-hidden','true'); }

$('searchInput').addEventListener('input', e => renderMenu(e.target.value));
document.querySelectorAll('.guest-pill').forEach(btn => btn.onclick = () => { document.querySelectorAll('.guest-pill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.activeGuest = btn.dataset.guest; });
$('qtyMinus').onclick = () => { state.qty = Math.max(1, state.qty - 1); updateModalTotal(); };
$('qtyPlus').onclick = () => { state.qty++; updateModalTotal(); };
$('addToCart').onclick = addSelected;
$('modalClose').onclick = () => closeLayer('itemModal');
$('itemModal').onclick = e => { if(e.target === $('itemModal')) closeLayer('itemModal'); };
$('mobileCartBtn').onclick = openCart; $('closeCart').onclick = closeCart;
$('checkoutForm').addEventListener('submit', submitOrder);
$('openBill').onclick = openBill; $('openBillTop').onclick = openBill;
$('billClose').onclick = () => closeLayer('billSheet');
$('billSheet').onclick = e => { if(e.target === $('billSheet')) closeLayer('billSheet'); };
document.querySelectorAll('.bill-tabs button').forEach(btn => btn.onclick = () => { document.querySelectorAll('.bill-tabs button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.splitMode = btn.dataset.split; renderSplit(); });
$('customKeypad').querySelectorAll('button').forEach(btn => btn.onclick = () => { const input = $('customAmount'); let raw = input.dataset.raw || ''; const v = btn.textContent; raw = v === '⌫' ? raw.slice(0,-1) : (raw + v).replace(/(\..*)\./g,'$1').slice(0,7); input.dataset.raw = raw; input.dataset.value = String(Number(raw || 0)); input.value = raw ? `$${raw}` : ''; renderSplit(); });
$('payNow').onclick = markPaid;
$('newRound').onclick = () => closeLayer('paidState');
$('paidState').onclick = e => { if(e.target === $('paidState')) closeLayer('paidState'); };
addEventListener('keydown', e => { if(e.key === 'Escape'){ ['itemModal','billSheet','paidState'].forEach(closeLayer); closeCart(); } });

applyTableContext();
loadMenu();
