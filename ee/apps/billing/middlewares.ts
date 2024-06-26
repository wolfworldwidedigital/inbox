import { createMiddleware } from 'hono/factory';
import type { Ctx } from './ctx';
import { env } from './env';
import { stripeSdk } from './stripe';

export const stripeWebhookMiddleware = createMiddleware<Ctx>(
  async (ctx, next) => {
    const stripeSignature = ctx.req.header('stripe-signature');
    const body = await ctx.req.raw.text();
    if (!stripeSignature || !body) {
      return ctx.json(null, 401);
    }
    try {
      ctx.set(
        'stripeEvent',
        stripeSdk.webhooks.constructEvent(
          body,
          stripeSignature,
          env.BILLING_STRIPE_WEBHOOK_KEY
        )
      );
      await next();
    } catch (e) {
      console.error(e);
      return ctx.json(null, 401);
    }
  }
);
