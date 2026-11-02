const test = require("node:test");
const assert = require("node:assert");
const { total } = require("./app");

test("descuento del 50%", () => {
  assert.strictEqual(total(100, 2, 0.5), 100);
});
