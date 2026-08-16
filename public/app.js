const state = { menu: null, selected: null, qty: 1, cart: JSON.parse(localStorage.getItem('kochi_cart') || '[]') };
const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const slug = (s) => `cat-${s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-')}`;

async function loadMenu(){
  const res = await fetch('/data/menu.json');
  state.menu = await res.json();
  renderMenu(); renderCart();
}

function allItems(){ return state.menu.categories.flatMap(c => c.items.map(item => ({...item, category: c.name}))); }

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
    btn.type = 'button'; btn.textContent = category.korean ? `${category.name} · ${category.korean}` : category.name;
    btn.onclick = () => document.getElementById(slug(category.name)).scrollIntoView({behavior:'smooth', block:'start'});
    $('categoryRail').appendChild(btn);

    const sec = document.createElement('section');
    sec.className = 'menu-section'; sec.id = slug(category.name);
    sec.innerHTML = `<div class="section-title"><h3>${category.name}${category.korean ? ` <span class="kr">${category.korean}</span>` : ''}</h3><span>${matches.length} items</span></div><div class="item-grid"></div>`;
    const grid = sec.querySelector('.item-grid');
    matches.forEach(item => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'menu-card';
      const price = item.price > 0 ? money(item.price) : 'Ask';
      card.innerHTML = `<h4>${item.name}</h4>${item.korean ? `<div class="kr">${item.korean}</div>` : ''}${item.badge ? `<span class="badge">${item.badge}</span>` : ''}<p>${item.description || 'Available for pickup.'}</p><footer><span class="price">${price}</span><span class="add-dot">+</span></footer>`;
      card.onclick = () => openItem(category.name, item);
      grid.appendChild(card);
    });
    $('menuContent').appendChild(sec);
  });
  if(!sections) $('menuContent').innerHTML = `<div class="empty-cart">No matching menu items.</div>`;
  observeSections();
}

let observer;
function observeSections(){
  if(observer) observer.disconnect();
  observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible) return;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btn = [...document.querySelectorAll('.cat-btn')].find(b => slug(b.textContent.split(' · ')[0]) === visible.target.id);
    if(btn) btn.classList.add('active');
  }, {rootMargin:'-140px 0px -58% 0px', threshold:[0,.2,.5]});
  document.querySelectorAll('.menu-section').forEach(s => observer.observe(s));
}

function openItem(category, item){
  if(item.price <= 0) return;
  state.selected = {category, item}; state.qty = 1;
  $('modalCategory').textContent = category;
  $('modalName').textContent = item.korean ? `${item.name} · ${item.korean}` : item.name;
  $('modalDesc').textContent = item.description || '';
  $('modalPrice').textContent = money(item.price);
  $('itemNotes').value = '';
  updateModalTotal();
  $('itemModal').classList.add('open'); $('itemModal').setAttribute('aria-hidden','false');
}
function updateModalTotal(){ $('qtyValue').textContent = state.qty; $('addTotal').textContent = money(state.selected.item.price * state.qty); }
function saveCart(){ localStorage.setItem('kochi_cart', JSON.stringify(state.cart)); }
function addSelected(){
  const note = $('itemNotes').value.trim();
  const {category, item} = state.selected;
  state.cart.push({id: crypto.randomUUID(), category, name:item.name, korean:item.korean||'', price:item.price, qty:state.qty, note});
  closeModal(); saveCart(); renderCart();
}
function closeModal(){ $('itemModal').classList.remove('open'); $('itemModal').setAttribute('aria-hidden','true'); }
function totals(){
  const subtotal = state.cart.reduce((s,l)=>s + l.price*l.qty, 0);
  const tax = subtotal * (state.menu?.business?.taxRate ?? .1025);
  return { subtotal, tax, total: subtotal + tax, count: state.cart.reduce((s,l)=>s+l.qty,0) };
}
function renderCart(){
  const items = $('cartItems'); items.innerHTML = '';
  $('emptyCart').style.display = state.cart.length ? 'none' : 'block';
  state.cart.forEach((line, idx) => {
    const el = document.createElement('div'); el.className = 'cart-line';
    el.innerHTML = `<div class="cart-line-top"><div><h4>${line.name}${line.korean ? ` · ${line.korean}` : ''}</h4>${line.note ? `<small>${line.note}</small>` : ''}</div><b>${money(line.price*line.qty)}</b></div><div class="line-actions"><div class="qty-mini"><button data-act="minus" data-i="${idx}" type="button">−</button><span>${line.qty}</span><button data-act="plus" data-i="${idx}" type="button">+</button></div><button class="remove" data-act="remove" data-i="${idx}" type="button">Remove</button></div>`;
    items.appendChild(el);
  });
  items.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    const i = Number(btn.dataset.i), act = btn.dataset.act;
    if(act === 'plus') state.cart[i].qty++;
    if(act === 'minus') state.cart[i].qty = Math.max(1, state.cart[i].qty - 1);
    if(act === 'remove') state.cart.splice(i, 1);
    saveCart(); renderCart();
  });
  const t = totals();
  $('subtotal').textContent = money(t.subtotal); $('tax').textContent = money(t.tax); $('total').textContent = money(t.total);
  $('cartCount').textContent = t.count; $('mobileCount').textContent = t.count; $('mobileTotal').textContent = money(t.total);
  $('checkoutBtn').disabled = !state.cart.length;
}
async function submitOrder(e){
  e.preventDefault();
  const form = e.currentTarget;
  if(!state.cart.length) return;
  const fd = new FormData(form);
  const t = totals();
  $('orderStatus').className = ''; $('orderStatus').textContent = 'Sending order preview…';
  try{
    const res = await fetch('/api/order', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({customer:Object.fromEntries(fd.entries()), items:state.cart, totals:t, source:'kochi-direct-preview'})});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Order failed');
    $('orderStatus').className = 'success'; $('orderStatus').textContent = `Preview order received: ${data.orderId}. Connect email/SMS/Stripe to make this production.`;
    state.cart = []; saveCart(); renderCart(); form.reset();
  }catch(err){ $('orderStatus').className = 'error'; $('orderStatus').textContent = err.message || 'Could not send order.'; }
}
$('searchInput').addEventListener('input', e => renderMenu(e.target.value));
$('qtyMinus').onclick = () => { state.qty = Math.max(1, state.qty - 1); updateModalTotal(); };
$('qtyPlus').onclick = () => { state.qty++; updateModalTotal(); };
$('addToCart').onclick = addSelected; $('modalClose').onclick = closeModal; $('itemModal').onclick = e => { if(e.target === $('itemModal')) closeModal(); };
$('cartTop').onclick = () => $('cartPanel').classList.add('open'); $('mobileCartBtn').onclick = () => $('cartPanel').classList.add('open'); $('closeCart').onclick = () => $('cartPanel').classList.remove('open');
$('checkoutForm').addEventListener('submit', submitOrder);
loadMenu();
