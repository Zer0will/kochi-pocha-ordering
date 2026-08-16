# Kochi Po-cha Direct Ordering Preview

A standalone direct-ordering preview for Kochi Po-cha / 코치포차 in Lynnwood, WA.

## Goal

Replace a percentage-based third-party ordering flow with an owned, lower-fee direct system:

1. Customer orders on Kochi-branded site.
2. Restaurant receives order via email/SMS/tablet/POS middleware.
3. Payment can start as pay-at-pickup, then move to Stripe Checkout.

## Current production status

- Static responsive ordering UI: complete.
- Menu data stored in `data/menu.json`: complete.
- Cart/order form: complete.
- Vercel API boundary at `/api/order`: complete, preview-only.
- Real restaurant notification: not connected yet.
- Real payment: not connected yet.

## Lower-fee recommendation

Best rollout:

### Phase 1 — Direct order + pay at pickup

- Orders POST to `/api/order`.
- Add Resend/SendGrid email or Twilio SMS credentials in Vercel env.
- Customer pays at pickup.
- Lowest complexity, no payment processor work, no marketplace commission.

### Phase 2 — Stripe Checkout

- API creates Stripe Checkout session.
- Stripe collects card payment.
- Webhook confirms paid order before notifying kitchen.
- Usually processor-fee only rather than Menu11-style percentage platform commission.

### Phase 3 — Kitchen ops dashboard/POS

- Add Supabase, Google Sheets, Airtable, Square, Toast middleware, or a small kitchen dashboard.
- Only do this after the owner validates direct order demand.

## Development

```bash
npm run check
vercel dev
```

## Deployment

Static files deploy directly on Vercel. Serverless order preview lives in `api/order.js`.

## Safety

No secrets are stored in the repo. Add production credentials only as Vercel environment variables.
