const ORDERS_API = "https://api.squarespace.com/1.0/commerce/orders";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function collectStrings(value, bucket = []) {
  if (value == null) return bucket;
  if (typeof value === "string" || typeof value === "number") {
    bucket.push(String(value));
    return bucket;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, bucket);
    return bucket;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, bucket);
  }
  return bucket;
}

function orderIdentifiers(order) {
  return [
    order.id,
    order.orderId,
    order.orderNumber,
    order.orderNo,
    order.orderNumberFormatted,
    order.orderNumberText,
  ].filter(Boolean);
}

function orderEmails(order) {
  return [
    order.customerEmail,
    order.email,
    order.customer?.email,
    order.billingAddress?.email,
    order.shippingAddress?.email,
    order.recipientEmail,
  ].filter(Boolean);
}

export function orderContainsStarterProduct(order, starterSlug) {
  const slug = normalize(starterSlug || "custom-design-starter");
  const haystack = collectStrings([order.lineItems, order.fulfillments, order.items, order.products]).join(" ").toLowerCase();
  return haystack.includes(slug) || haystack.includes("custom design starter");
}

export function findVerifiedStarterOrder({ orders, email, orderNumber, starterSlug }) {
  const wantedEmail = normalize(email);
  const wantedOrder = normalize(orderNumber);
  return (orders || []).find((order) => {
    const idMatch = orderIdentifiers(order).some((value) => normalize(value) === wantedOrder);
    const emailMatch = orderEmails(order).some((value) => normalize(value) === wantedEmail);
    return idMatch && emailMatch && orderContainsStarterProduct(order, starterSlug);
  });
}

export async function fetchRecentSquarespaceOrders({
  apiKey,
  lookbackDays = 30,
  maxPages = 5,
  fetchImpl = fetch,
  now = new Date(),
}) {
  if (!apiKey) {
    const error = new Error("Squarespace Orders API key is not configured.");
    error.code = "SQUARESPACE_API_KEY_MISSING";
    throw error;
  }
  const orders = [];
  let cursor = "";
  const modifiedAfter = new Date(now.getTime() - Number(lookbackDays) * 24 * 60 * 60 * 1000).toISOString();

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(ORDERS_API);
    url.searchParams.set("modifiedAfter", modifiedAfter);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "AugNach AI Custom Flow",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Squarespace returned HTTP ${response.status}`);
      error.code = "SQUARESPACE_API_ERROR";
      error.status = response.status;
      throw error;
    }
    orders.push(...(payload.orders || payload.result || []));
    cursor = payload.pagination?.nextPageCursor || payload.cursor || "";
    if (!cursor) break;
  }

  return orders;
}

export async function verifySquarespaceStarterPayment({
  email,
  orderNumber,
  apiKey = process.env.SQUARESPACE_API_KEY,
  starterSlug = process.env.CUSTOM_STARTER_PRODUCT_SLUG || "custom-design-starter",
  lookbackDays = Number(process.env.SQUARESPACE_ORDER_LOOKBACK_DAYS || 30),
  fetchImpl = fetch,
}) {
  const orders = await fetchRecentSquarespaceOrders({ apiKey, lookbackDays, fetchImpl });
  const order = findVerifiedStarterOrder({ orders, email, orderNumber, starterSlug });
  if (!order) return { verified: false, code: "ORDER_NOT_FOUND" };
  return {
    verified: true,
    orderId: order.id || order.orderId || "",
    orderNumber: order.orderNumber || order.orderNo || orderNumber,
  };
}
