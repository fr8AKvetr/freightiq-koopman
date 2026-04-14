// ─── Koopman Engine — pure math, no React ─────────────────────────────────────

export function buildFeatures(s) {
  const f = [];
  f.push(s.spot_rate, s.ltr, s.fuel_index, s.cap_util, s.contract_spread, s.days_since_shock, s.day_of_year);
  f.push(s.spot_rate * s.ltr, s.fuel_index * s.cap_util, s.spot_rate * s.fuel_index, s.ltr ** 2, s.contract_spread * s.ltr);
  const doy = 2 * Math.PI * s.day_of_year / 365;
  for (let k = 1; k <= 3; k++) { f.push(Math.sin(k * doy)); f.push(Math.cos(k * doy)); }
  const dow = 2 * Math.PI * (s.day_of_year % 7) / 7;
  f.push(Math.sin(dow), Math.cos(dow));
  f.push(Math.exp(-s.days_since_shock / 14));
  const tight = s.ltr > 4.5 ? 1 : 0;
  const soft  = s.ltr < 2.0 ? 1 : 0;
  f.push(tight, soft, tight * s.spot_rate, soft * s.spot_rate);
  return f;
}

export function generateData(nDays = 365, baseRate = 2.4, seed = 42) {
  let rng = (() => { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
  const randn = () => { let u=0,v=0; while(!u) u=rng(); while(!v) v=rng(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  const days = Array.from({length: nDays}, (_, i) => i);
  const shockDays = new Set(Array.from({length: 8}, () => Math.floor(rng() * nDays)));
  let fuel = 1.0, noise = 0;
  return days.map((d) => {
    const seasonal = 0.15*Math.sin(2*Math.PI*d/365+1.0) + 0.04*Math.sin(2*Math.PI*d/91) + 0.02*Math.sin(2*Math.PI*d/7);
    const ltr = Math.max(1.2, Math.min(7.0, 3.0 + 1.2*Math.sin(2*Math.PI*d/365+0.8) + randn()*0.3));
    fuel += randn() * 0.004; fuel = Math.max(0.7, Math.min(1.5, fuel));
    noise = 0.7*noise + randn()*0.03;
    let shockSignal = 0, daysSince = 999;
    shockDays.forEach(sd => {
      if (d >= sd) {
        shockSignal += 0.2 * Math.exp(-(d - sd) / 14);
        daysSince = Math.min(daysSince, d - sd);
      }
    });
    const cap_util = Math.max(0.4, Math.min(0.98, 0.72 + 0.12*Math.sin(2*Math.PI*d/365) + randn()*0.04));
    const spot_rate = Math.max(1.2, baseRate + seasonal + 0.08*(ltr-3) + 0.15*(fuel-1) + shockSignal + noise);
    const contract_spread = spot_rate - (baseRate + 0.5*seasonal);
    return { spot_rate, ltr, fuel_index: fuel, day_of_year: (d%365)+1, days_since_shock: daysSince, cap_util, contract_spread };
  });
}

export function fitKoopman(data, reg = 1e-4) {
  const states = data.map(buildFeatures);
  const n = states.length, d = states[0].length;
  const mean = new Array(d).fill(0), std = new Array(d).fill(0);
  states.forEach(s => s.forEach((v, j) => { mean[j] += v / n; }));
  states.forEach(s => s.forEach((v, j) => { std[j] += (v - mean[j])**2 / n; }));
  std.forEach((v, j) => { std[j] = Math.sqrt(v) + 1e-8; });
  const G = states.map(s => s.map((v, j) => (v - mean[j]) / std[j]));
  const G_now = G.slice(0, -1), G_next = G.slice(1);
  const GtG = Array.from({length: d}, (_, i) => Array.from({length: d}, (_, j) => {
    let s = 0;
    for (let k = 0; k < G_now.length; k++) s += G_now[k][i] * G_now[k][j];
    return s + (i === j ? reg * G_now.length : 0);
  }));
  const GtGn = Array.from({length: d}, (_, i) => Array.from({length: d}, (_, j) => {
    let s = 0;
    for (let k = 0; k < G_now.length; k++) s += G_now[k][i] * G_next[k][j];
    return s;
  }));
  const K = solveLinear(GtG, GtGn, d);
  let residSumSq = 0;
  for (let t = 0; t < G_now.length; t++) {
    const pred = K[0].reduce((s, v, j) => s + v * G_now[t][j], 0);
    residSumSq += (G_next[t][0] - pred)**2;
  }
  return { K, mean, std, residStd: Math.sqrt(residSumSq / G_now.length), d };
}

export function solveLinear(A, B, d) {
  const K = Array.from({length: d}, () => new Array(d).fill(0));
  for (let col = 0; col < d; col++) {
    const b = B.map(row => row[col]);
    const aug = A.map((row, i) => [...row, b[i]]);
    for (let pivot = 0; pivot < d; pivot++) {
      let maxRow = pivot;
      for (let r = pivot+1; r < d; r++) if (Math.abs(aug[r][pivot]) > Math.abs(aug[maxRow][pivot])) maxRow = r;
      [aug[pivot], aug[maxRow]] = [aug[maxRow], aug[pivot]];
      const pivotVal = aug[pivot][pivot];
      if (Math.abs(pivotVal) < 1e-12) continue;
      for (let r = 0; r < d; r++) {
        if (r === pivot) continue;
        const factor = aug[r][pivot] / pivotVal;
        for (let c = pivot; c <= d; c++) aug[r][c] -= factor * aug[pivot][c];
      }
      for (let c = pivot; c <= d; c++) aug[pivot][c] /= pivotVal;
    }
    for (let row = 0; row < d; row++) K[row][col] = aug[row][d];
  }
  return K;
}

export function propagate(K, g0, steps) {
  const traj = [g0];
  let g = [...g0];
  for (let i = 0; i < steps; i++) {
    g = K.map(row => row.reduce((s, v, j) => s + v * g[j], 0));
    traj.push([...g]);
  }
  return traj;
}

export function recoverRate(g_scaled, mean, std) {
  return g_scaled[0] * std[0] + mean[0];
}

export function runFromState(m, stateVec, horizonVal, marginVal) {
  const rawFeats = buildFeatures(stateVec);
  const g0 = rawFeats.map((v, j) => (v - m.mean[j]) / m.std[j]);
  const traj = propagate(m.K, g0, 14);
  const rates = traj.map(g => recoverRate(g, m.mean, m.std));
  const mgn = 1 + marginVal / 100;
  const points = rates.map((r, i) => {
    const unc = m.residStd * Math.sqrt(i) * m.std[0];
    return { day: i, rate: +(r * mgn).toFixed(4), low: +((r-unc)*mgn).toFixed(4), high: +((r+unc)*mgn).toFixed(4) };
  });
  return { points, pt: points[Math.min(horizonVal, 14)], g0 };
}
