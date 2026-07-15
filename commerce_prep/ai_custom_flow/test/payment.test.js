import test from "node:test";
import assert from "node:assert/strict";
import { fetchRecentSquarespaceOrders, findVerifiedStarterOrder, verifySquarespaceStarterPayment } from "../src/squarespace.js";

const starterOrder = {
  id: "order-1",
  orderNumber: "000123",
  customerEmail: "buyer@example.com",
  lineItems: [{ productName: "Custom Design Starter", productUrl: "/shop/p/custom-design-starter" }],
};

test("payment verification helper matches email, order number, and starter product", () => {
  const order = findVerifiedStarterOrder({
    orders: [starterOrder],
    email: "buyer@example.com",
    orderNumber: "000123",
    starterSlug: "custom-design-starter",
  });
  assert.equal(order.id, "order-1");
});

test("payment verification helper rejects wrong email", () => {
  const order = findVerifiedStarterOrder({
    orders: [starterOrder],
    email: "other@example.com",
    orderNumber: "000123",
    starterSlug: "custom-design-starter",
  });
  assert.equal(order, undefined);
});

test("payment verification helper rejects wrong product", () => {
  const order = findVerifiedStarterOrder({
    orders: [{ ...starterOrder, lineItems: [{ productName: "Regular Product", productUrl: "/shop/p/regular" }] }],
    email: "buyer@example.com",
    orderNumber: "000123",
    starterSlug: "custom-design-starter",
  });
  assert.equal(order, undefined);
});

test("payment verifier reports missing Squarespace API key", async () => {
  await assert.rejects(
    verifySquarespaceStarterPayment({
      email: "buyer@example.com",
      orderNumber: "000123",
      apiKey: "",
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    /Squarespace Orders API key is not configured/,
  );
});

test("payment verifier reports Squarespace API failure", async () => {
  await assert.rejects(
    verifySquarespaceStarterPayment({
      email: "buyer@example.com",
      orderNumber: "000123",
      apiKey: "test",
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: "bad key" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    }),
    /bad key/,
  );
});

test("Squarespace order lookup sends both modified date bounds", async () => {
  let requestedUrl = "";
  await fetchRecentSquarespaceOrders({
    apiKey: "test",
    now: new Date("2026-07-15T12:00:00.000Z"),
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ orders: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const params = new URL(requestedUrl).searchParams;
  assert.equal(params.get("modifiedAfter"), "2026-06-15T12:00:00.000Z");
  assert.equal(params.get("modifiedBefore"), "2026-07-15T12:00:00.000Z");
});
