import test from "node:test";
import assert from "node:assert/strict";
import { createRefuelingOrderMutationOptions } from "./refueling-order-mutation";

test("a failed group-order update keeps its payload available for retry", async () => {
  const submittedDeals = [{ productType: "kerosene", quantityLiters: 125 }];
  const originalPayload = JSON.stringify(submittedDeals);
  const requests: Array<{ method: string; url: string; data: unknown }> = [];
  const errors: Array<{ message: string; module: string }> = [];
  let invalidations = 0;
  let successNotifications = 0;
  let dialogClosures = 0;
  let shouldFail = true;

  const options = createRefuelingOrderMutationOptions({
    orderId: "order-42",
    request: async (method, url, data) => {
      requests.push({ method, url, data });
      if (shouldFail) throw new Error("Сервер временно недоступен");
      return { json: async () => ({ updated: true }) };
    },
    invalidateOrderQueries: () => {
      invalidations += 1;
    },
    notifySuccess: () => {
      successNotifications += 1;
    },
    showError: (message, module) => errors.push({ message, module }),
    onSuccess: () => {
      dialogClosures += 1;
    },
  });

  await assert.rejects(options.mutationFn(submittedDeals), /Сервер временно недоступен/);
  options.onError(new Error("Сервер временно недоступен"));

  assert.deepEqual(requests[0], {
    method: "PUT",
    url: "/api/refueling/order/order-42",
    data: { deals: submittedDeals },
  });
  assert.deepEqual(errors, [
    { message: "Сервер временно недоступен", module: "refueling" },
  ]);
  assert.equal(JSON.stringify(submittedDeals), originalPayload);
  assert.equal(invalidations, 0);
  assert.equal(successNotifications, 0);
  assert.equal(dialogClosures, 0);

  shouldFail = false;
  const result = await options.mutationFn(submittedDeals);
  options.onSuccess(result);

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].data, { deals: submittedDeals });
  assert.equal(invalidations, 1);
  assert.equal(successNotifications, 1);
  assert.equal(dialogClosures, 1);
});

test("a blank update error displays a useful retry message", () => {
  let displayedError = "";
  const options = createRefuelingOrderMutationOptions({
    orderId: "order-42",
    request: async () => ({ json: async () => ({}) }),
    invalidateOrderQueries: () => {},
    notifySuccess: () => {},
    showError: (message) => {
      displayedError = message;
    },
  });

  options.onError(new Error("  "));

  assert.match(displayedError, /Не удалось сохранить заказ заправки/);
});
