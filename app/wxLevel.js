// Five work levels for one hour of weather (outdoor work). Used for the colour of the hourly icons and the status word.
// Rules (mph, percent, Fahrenheit): the worst of rain chance / sky / wind / temperature and any official warning that is still active.
export const WX_LEVELS = [
  { n: 1, t: 'Good to work', c: '#1e6b3a' },
  { n: 2, t: 'Advisory', c: '#c99a00' },
  { n: 3, t: 'Watch', c: '#e8710a' },
  { n: 4, t: 'Warning', c: '#c0392b' },
  { n: 5, t: 'Emergency', c: '#7b2cbf' },
];
const alertLevel = (a) => {
  const e = String((a && a.event) || ''); const s = String((a && a.severity) || '');
  if (s === 'Extreme' || /emergency|tornado warning/i.test(e)) return 5;
  if (s === 'Severe' || /warning/i.test(e)) return 4;
  if (/watch/i.test(e)) return 3;
  return 2;
};
export function hourLevel(h, alerts) {
  let n = 1;
  const code = Number(h.code) || 0; const prob = Number(h.prob) || 0; const wind = Number(h.wind) || 0; const temp = Number(h.temp);
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const rainy = code >= 51;
  if (code >= 95) n = Math.max(n, 4);
  if (wind >= 35) n = Math.max(n, 4); else if (wind >= 25) n = Math.max(n, 3); else if (wind >= 20) n = Math.max(n, 2);
  if (snow) n = Math.max(n, 3);
  if (rainy && prob >= 60) n = Math.max(n, 3); else if (prob >= 30) n = Math.max(n, 2);
  if (temp <= 32 || temp >= 90) n = Math.max(n, 2);
  for (const a of alerts || []) {
    const end = String((a && a.ends) || '').slice(0, 16);
    if (!end || String(h.t).slice(0, 16) < end) n = Math.max(n, alertLevel(a));
  }
  return WX_LEVELS[n - 1];
}

// Why an hour got its level, in a few words (for the worst-case line).
export function hourWhy(h, alerts) {
  const code = Number(h.code) || 0; const prob = Number(h.prob) || 0; const wind = Number(h.wind) || 0; const temp = Number(h.temp);
  const w = [];
  const lvl = hourLevel(h, alerts).n;
  for (const a of alerts || []) { const end = String((a && a.ends) || '').slice(0, 16); if ((!end || String(h.t).slice(0, 16) < end) && a.event) { w.push(a.event); break; } }
  if (code >= 95) w.push('thunderstorm');
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) w.push('snow');
  else if (code >= 51 && prob >= 30) w.push('rain ' + prob + '%');
  else if (prob >= 30) w.push('chance of rain ' + prob + '%');
  if (wind >= 20) w.push('wind ' + wind + ' mph');
  if (temp <= 32) w.push('freezing ' + temp + ' F'); else if (temp >= 90) w.push('hot ' + temp + ' F');
  return w.length ? w.slice(0, 3).join(', ') : (lvl > 1 ? 'conditions' : '');
}
