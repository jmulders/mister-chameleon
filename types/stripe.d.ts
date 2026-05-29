/**
 * Stripe SDK type shim
 *
 * Provides minimal TypeScript declarations for the `stripe` npm package.
 * Replace this file with the real Stripe SDK by running:
 *
 *   npm install stripe
 *
 * Once installed, delete this file — the real package provides its own types.
 */

declare module "stripe" {
  class Stripe {
    constructor(secretKey: string, options?: { apiVersion?: string; typescript?: boolean });

    customers: {
      create(params: { metadata?: Record<string, string> }): Promise<Stripe.Customer>;
    };

    checkout: {
      sessions: {
        create(params: Record<string, unknown>): Promise<{ id: string; url: string | null }>;
      };
    };

    webhooks: {
      constructEvent(
        body:      string,
        signature: string,
        secret:    string,
      ): Stripe.Event;
    };
  }

  namespace Stripe {
    interface Event {
      id:   string;
      type: string;
      data: { object: unknown };
    }

    interface Customer {
      id: string;
    }

    interface PaymentIntent {
      id: string;
    }

    interface Price {
      id: string;
    }

    interface SubscriptionItem {
      price: Price;
    }

    interface Subscription {
      id:                   string;
      customer:             string | Customer;
      status:               string;
      items:                { data: SubscriptionItem[] };
      current_period_start: number;
      current_period_end:   number;
      cancel_at_period_end: boolean;
      canceled_at:          number | null;
    }

    interface InvoiceLineItem {
      period: { start: number; end: number };
      price:  Price | null;
    }

    interface Invoice {
      customer: string | Customer;
      lines:    { data: InvoiceLineItem[] };
    }

    /** Alias used as Stripe.Checkout.Session.Session in the real SDK */
    interface CheckoutSession {
      id:             string;
      mode:           "payment" | "subscription" | "setup";
      customer:       string | Customer | null;
      subscription:   string | Subscription | null;
      payment_intent: string | PaymentIntent | null;
      metadata:       Record<string, string> | null;
    }

    namespace Checkout {
      namespace Session {
        // Re-export so both Stripe.Checkout.Session.Session and
        // Stripe.CheckoutSession refer to the same shape.
        type Session = Stripe.CheckoutSession;
      }
    }
  }

  export = Stripe;
}
