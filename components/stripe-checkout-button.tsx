"use client";

import { useState } from "react";

type Plan = "payg" | "monthly_15" | "monthly_30";

interface StripeCheckoutButtonProps {
  plan: Plan;
  customerEmail?: string;
  children: React.ReactNode;
}

export default function StripeCheckoutButton({
  plan,
  customerEmail,
  children,
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/stripe/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            plan,
            customerEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (!data.url) {
        throw new Error("Stripe Checkout URL was not returned");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to start checkout"
      );

      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}