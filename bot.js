const express = require('express');
const app = express();
app.use(express.json());

const TOKEN   = '8705581943:AAGSyEKXdishm0GBVYbE60sXeqYuRaeRLLI';
const CHAT_ID = '7248045188';
const API     = `https://api.telegram.org/bot${TOKEN}`;

let bookings = {};
let blocked  = {};

app.post('/webhook', async (req, res) => {
  const msg = req.body.message;
  if (!msg || String(msg.chat.id) !== CHAT_ID) return res.sendStatus(200);
  const text = (msg.text || '').toLowerCase().trim();
  let reply = '';

  if (text === '/start' || text === 'hello' || text === 'hi') {
    reply = `👋 Hey! I'm your Kenya Car Wash bot 🇰🇪\n\nHere's what you can ask me:\n\n/today – Today's booking\n/thisweek – This week's plan\n/nextweek – Next week's plan\n/raised – How much raised so far\n/isfree dd/mm/yyyy – Check if a date is free`;

  } else if (text === '/today') {
    reply = buildDayReply(getDateStr(new Date()), 'Today');

  } else if (text === '/thisweek') {
    reply = buildWeekReply(new Date());

  } else if (text === '/nextweek') {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    reply = buildWeekReply(next);

  } else if (text === '/raised') {
    const count = Object.keys(bookings).length;
    const min = count * 20;
    reply = `🇰🇪 <b>Kenya 2027 Fundraiser</b>\n\n✅ Bookings made: <b>${count}</b>\n💷 Minimum raised: <b>£${min}</b>\n🎯 Goal: <b>£4,600</b>\n📊 Progress: <b>${Math.round((min/4600)*100)}%</b>`;

  } else if (text.startsWith('/isfree')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      reply = '❓ Usage: /isfree dd/mm/yyyy\nExample: /isfree 14/04/2026';
    } else {
      const dateStr = parseDate(parts[1]);
      if (!dateStr) {
        reply = '❌ Invalid date. Use format: /isfree dd/mm/yyyy';
      } else {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay();
        const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (day === 0 || day === 5 || day === 6) {
          reply = `❌ <b>${label}</b> is not a car wash day.\nWashes run Monday – Thursday only.`;
        } else if (blocked[dateStr]) {
          reply = `🚫 <b>${label}</b> is blocked.\nReason: ${blocked[dateStr].reason}`;
        } else if (bookings[dateStr]) {
          const b = bookings[dateStr];
          reply = `❌ <b>${label}</b> is already booked!\n\n👤 ${b.name}\n🚗 ${b.make} ${b.model}\n🔤 ${b.reg}`;
        } else {
          reply = `✅ <b>${label}</b> is free and available to book!`;
        }
      }
    }

  } else {
    reply = `❓ I didn't understand that. Try:\n\n/today\n/thisweek\n/nextweek\n/raised\n/isfree dd/mm/yyyy`;
  }

  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: reply, parse_mode: 'HTML' })
  });

  res.sendStatus(200);
});

app.post('/newbooking', (req, res) => {
  const { date, name, email, make, model, reg, tip, total } = req.body;
  if (date) bookings[date] = { name, email, make, model, reg, tip, total };
  res.sendStatus(200);
});

app.post('/updateblocked', (req, res) => {
  blocked = req.body.blocked || {};
  res.sendStatus(200);
});

function getDateStr(d) {
  return d.toISOString().split('T')[0];
}

function parseDate(str) {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

function buildDayReply(dateStr, label) {
  const d = new Date(dateStr + 'T00:00:00');
  const friendly = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (blocked[dateStr]) return `🚫 <b>${label} (${friendly})</b> is blocked.\nReason: ${blocked[dateStr].reason}`;
  if (!bookings[dateStr]) return `⬜ <b>${label} (${friendly})</b>\nNo booking yet.`;
  const b = bookings[dateStr];
  return `✅ <b>${label} — ${friendly}</b>\n\n👤 ${b.name}\n🚗 ${b.make} ${b.model}\n🔤 Reg: <b>${b.reg}</b>\n💷 Total: ${b.total}\n🕒 3:00–4:00 PM · Bike Lockup`;
}

function buildWeekReply(anyDate) {
  const d = new Date(anyDate);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const weekLabel = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  let reply = `📆 <b>Week of ${weekLabel}</b>\n\n`;
  for (let i = 0; i < 4; i++) {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    const ds = getDateStr(dd);
    const lbl = dd.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    if (blocked[ds]) {
      reply += `🚫 <b>${lbl}</b> — ${blocked[ds].reason}\n`;
    } else if (bookings[ds]) {
      const b = bookings[ds];
      reply += `✅ <b>${lbl}</b>\n   👤 ${b.name} · 🚗 ${b.make} ${b.model} · 🔤 ${b.reg} · 💷 ${b.total}\n`;
    } else {
      reply += `⬜ <b>${lbl}</b> — No booking\n`;
    }
  }
  return reply;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));