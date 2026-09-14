import test from "node:test";
import assert from "node:assert/strict";
import { generateData, fitKoopman, runFromState } from "../src/engine/koopman.js";

test("future shocks have no effect before onset; decay and superposition hold", () => {
  const baseline = generateData(60, 2.4, 99, []);
  const single = generateData(60, 2.4, 99, [20]);
  const multiple = generateData(60, 2.4, 99, [20, 40]);
  assert.deepEqual(single.slice(0, 20), baseline.slice(0, 20));
  assert.deepEqual(multiple.slice(0, 40), single.slice(0, 40));
  for (let day = 20; day < 60; day++) {
    assert.ok(Math.abs(single[day].spot_rate - baseline[day].spot_rate - 0.2 * Math.exp(-(day - 20) / 14)) < 1e-12);
    assert.equal(single[day].days_since_shock, day - 20);
  }
  assert.ok(Math.abs(multiple[40].spot_rate - single[40].spot_rate - 0.2) < 1e-12);
  assert.equal(multiple[40].days_since_shock, 0);
  assert.deepEqual(generateData(60, 2.4, 99, [70]), baseline);
  assert.deepEqual(generateData(60, 2.4, 99, [20, 20]), single);
});

test("seeded generation is deterministic and produces finite ordered research projections", () => {
  const data = generateData();
  assert.deepEqual(generateData(), data);
  const model = fitKoopman(data.slice(0, 180));
  const { points } = runFromState(model, data[179], 7, 8);
  assert.equal(points.length, 15);
  for (const point of points) {
    assert.ok(Number.isFinite(point.rate));
    assert.ok(point.low <= point.rate && point.rate <= point.high);
  }
});
