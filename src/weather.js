// Real weather outside the office (Manaíra, João Pessoa) from Open-Meteo: free, no key, CORS-friendly.
// Drives the window views (rain, clouds, sun rays), the sun shafts on the floor and the header line.
const API = 'https://api.open-meteo.com/v1/forecast?latitude=-7.10&longitude=-34.84'
  + '&current=temperature_2m,weather_code,is_day,cloud_cover,precipitation&timezone=America%2FFortaleza';
const EVERY = 10 * 60e3;

// kind: what the windows draw. sun: how much direct sunlight reaches the floor (0..1).
export const weather = { ready: false, kind: 'clear', temp: null, sun: 1, clouds: 0, rain: 0, label: '' };

// WMO weather codes -> [kind, emoji, Portuguese label]
function describe(code) {
  if (code === 0) return ['clear', '☀️', 'Céu limpo'];
  if (code === 1) return ['clear', '🌤️', 'Poucas nuvens'];
  if (code === 2) return ['cloudy', '⛅', 'Parcialmente nublado'];
  if (code === 3) return ['cloudy', '☁️', 'Nublado'];
  if (code === 45 || code === 48) return ['fog', '🌫️', 'Neblina'];
  if (code >= 51 && code <= 57) return ['drizzle', '🌦️', 'Garoa'];
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['rain', '🌧️', code === 65 || code === 82 ? 'Chuva forte' : 'Chuva'];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['snow', '❄️', 'Neve'];
  if (code >= 95) return ['storm', '⛈️', 'Tempestade'];
  return ['cloudy', '☁️', 'Nublado'];
}

async function load() {
  try {
    const c = (await (await fetch(API, { cache: 'no-store' })).json()).current;
    const [kind, icon, text] = describe(c.weather_code);
    const night = !c.is_day && (kind === 'clear');
    Object.assign(weather, {
      ready: true, kind, temp: Math.round(c.temperature_2m),
      clouds: Math.min(1, (c.cloud_cover || 0) / 100),
      rain: kind === 'storm' ? 1 : kind === 'rain' ? 0.75 : kind === 'drizzle' ? 0.35 : 0,
      sun: { clear: 1 - Math.min(1, (c.cloud_cover || 0) / 100) * 0.5, cloudy: 0.3, fog: 0.15, drizzle: 0.15, rain: 0, storm: 0, snow: 0.2 }[kind],
      label: `${night ? '🌙' : icon} ${Math.round(c.temperature_2m)}°C · ${text}`,
    });
  } catch (err) { console.warn('weather', err); } // offline: keep the last reading (or plain clear sky)
}

export function startWeather() { load(); setInterval(load, EVERY); }

/* ---------- window effects (drawn over a window's sky view, clipped to it) ---------- */
export function drawWindowWeather(g, x, y, w, h, t, day, seed) {
  if (!weather.ready) return;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // grey sky wash for clouds / rain / fog
  const grey = weather.kind === 'clear' ? weather.clouds * 0.25 : weather.kind === 'cloudy' ? 0.35 + weather.clouds * 0.2 : 0.55;
  if (grey > 0.02) { g.fillStyle = `rgba(${day > 0.5 ? '150,160,172' : '40,46,60'},${grey})`; g.fillRect(x, y, w, h); }
  // drifting clouds
  const nClouds = weather.kind === 'clear' ? Math.round(weather.clouds * 3) : 3;
  for (let i = 0; i < nClouds; i++) {
    const cx = x + ((t * (3 + i) + seed * 37 + i * 41) % (w + 30)) - 15, cy = y + 4 + i * 5;
    g.fillStyle = day > 0.4 ? `rgba(240,244,248,${0.75 - i * 0.1})` : 'rgba(90,98,120,.6)';
    g.fillRect(cx | 0, cy | 0, 14, 3); g.fillRect((cx + 3) | 0, (cy - 2) | 0, 8, 2);
  }
  // sun rays on a clear day
  if (weather.sun > 0.6 && day > 0.6) {
    g.fillStyle = `rgba(255,236,170,${0.10 + 0.06 * Math.sin(t * 0.8)})`;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + w - 4, y); g.lineTo(x + w - 18 - i * 14, y + h); g.lineTo(x + w - 12 - i * 14, y + h); g.fill(); }
  }
  // rain streaks
  if (weather.rain > 0) {
    g.fillStyle = day > 0.4 ? 'rgba(220,232,245,.55)' : 'rgba(160,180,220,.5)';
    const n = Math.round(w * h / 60 * weather.rain);
    for (let i = 0; i < n; i++) {
      const rx = (i * 53 + seed * 17) % w, sp = 60 + (i % 5) * 12;
      const ry = ((t * sp + i * 29) % (h + 8)) - 6;
      g.fillRect(x + ((rx + ry * 0.25) % w), y + ry, 1, 4);
    }
  }
  // lightning flash
  if (weather.kind === 'storm' && (Math.sin(t * 0.7) > 0.995 || Math.sin(t * 1.3 + 2) > 0.997)) { g.fillStyle = 'rgba(235,240,255,.75)'; g.fillRect(x, y, w, h); }
  if (weather.kind === 'fog') { g.fillStyle = 'rgba(220,224,230,.45)'; g.fillRect(x, y, w, h); }
  g.restore();
}
