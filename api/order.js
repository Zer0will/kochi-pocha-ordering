export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const items = Array.isArray(body.items) ? body.items : [];
  const customer = body.customer || {};
  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
  if (!customer.customerName || !customer.customerPhone) return res.status(400).json({ error: 'Name and phone are required' });

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const orderId = `KPC-${Date.now().toString(36).toUpperCase()}`;
  const order = {
    orderId,
    receivedAt: new Date().toISOString(),
    customer: {
      name: String(customer.customerName).slice(0, 100),
      phone: String(customer.customerPhone).slice(0, 40),
      pickupNote: String(customer.pickupNote || '').slice(0, 500)
    },
    items: items.map(item => ({
      name: String(item.name || '').slice(0, 160),
      korean: String(item.korean || '').slice(0, 160),
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      note: String(item.note || '').slice(0, 300)
    })),
    estimatedSubtotal: Math.round(subtotal * 100) / 100,
    mode: 'preview_no_payment_no_restaurant_notification'
  };

  // Production wiring options:
  // 1. Stripe Checkout session here, then webhook confirms paid orders.
  // 2. Resend/SendGrid email to restaurant.
  // 3. Twilio SMS to restaurant phone/kitchen tablet.
  // 4. Google Sheets/Airtable/Supabase insert for order log.
  // Keep secrets in Vercel env vars only; never client-side.
  console.log(JSON.stringify({ event: 'kochi_order_preview', order }));
  return res.status(200).json({ ok: true, orderId, order });
}
