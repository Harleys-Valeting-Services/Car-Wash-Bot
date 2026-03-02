const express = require('express');
const app = express();
app.use(express.json());

const TOKEN = '8705581943:AAGSyEKXdishm0GBVYbE60sXeqYuRaeRLLI';
const CHAT_ID = '7248045188';
const API = 'https://api.telegram.org/bot' + TOKEN;

let bookings = {};
let blocked = {};

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.message;
  if (!msg) return;
  if (String(msg.chat.id) !== CHAT_ID) return;

  const text = (msg.text || '').toLowerCase().trim();
  let reply = '';

  if (text === '/start' || text === 'hello' || text === 'hi') {
    reply = 'Hey! I am your Kenya Car Wash bot!\n\nHere is what you can ask me:\n\n/today - Today\'s booking\n/thisweek - This week\'s plan\n/nextweek - Next week\'s plan\n/raised - How much raised so far\n/isfree dd/mm/yyyy - Check if a date is free';

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
    const percent = Math.round((min / 4600) * 100);
    reply = 'Kenya 2027 Fundraiser\n\nBookings made: ' + count + '\nMinimum raised: £' + min + '\nGoal: £4,600\nProgress: ' + percent + '%';

  } else if (text.startsWith('/isfree')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      reply = 'Usage: /isfree dd/mm/yyyy\nExample: /isfree 14/04/2026';
    } else {
      const dateStr = parseDate(parts[1]);
      if (!dateStr) {
        reply = 'Invalid date. Use format: /isfree dd/mm/yyyy';
      } else {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay();
        const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (day === 0 || day === 5 || day === 6) {
          reply = label + ' is not a car wash day. Washes run Monday to Thursday only.';
        } else if (blocked[dateStr]) {
          reply = label + ' is blocked. Reason: ' + blocked[dateStr].reason;
        } else if (bookings[dateStr]) {
          const b = bookings[dateStr];
          reply = label + ' is already booked!\n\nName: ' + b.name + '\nCar: ' + b.make + ' ' + b.model + '\nReg: ' + b.reg;
        } else {
          reply = label + ' is free and available to book!';
        }
      }
    }

  } else {
    reply = 'I did not understand that. Try:\n\n/today\n/thisweek\n/nextweek\n/raised\n/isfree dd/mm/yyyy';
  }

  await fetch(API + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: reply })
  });
});

app.post('/newbooking', (req, res) => {
  const b = req.body;
  if (b.date) {
    bookings[b.date] = {
      name: b.name,
      email: b.email,
      make: b.make,
      model: b.model,
      reg: b.reg,
      tip: b.tip,
      total: b.total
    };
  }
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
  const dd = parts[0];
  const mm = parts[1];
  const yyyy = parts[2];
  if (!dd || !mm || !yyyy) return null;
  return yyyy + '-' + mm.padStart(2, '0') + '-' + dd.padStart(2, '0');
}

function buildDayReply(dateStr, label) {
  const d = new Date(dateStr + 'T00:00:00');
  const friendly = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (blocked[dateStr]) {
    return label + ' (' + friendly + ') is blocked. Reason: ' + blocked[dateStr].reason;
  }
  if (!bookings[dateStr]) {
    return label + ' (' + friendly + ') - No booking yet.';
  }
  const b = bookings[dateStr];
  return label + ' - ' + friendly + '\n\nName: ' + b.name + '\nCar: ' + b.make + ' ' + b.model + '\nReg: ' + b.reg + '\nTotal: ' + b.total + '\nTime: 3:00 - 4:00 PM\nLocation: Bike Lockup, Next to the Barrier';
}

function buildWeekReply(anyDate) {
  const d = new Date(anyDate);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const weekLabel = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  let reply = 'Week of ' + weekLabel + '\n\n';
  for (let i = 0; i < 4; i++) {
    const current = new Date(mon);
    current.setDate(mon.getDate() + i);
    const ds = getDateStr(current);
    const lbl = current.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    if (blocked[ds]) {
      reply = reply + 'BLOCKED - ' + lbl + ' - ' + blocked[ds].reason + '\n\n';
    } else if (bookings[ds]) {
      const b = bookings[ds];
      reply = reply + 'BOOKED - ' + lbl + '\nName: ' + b.name + '\nCar: ' + b.make + ' ' + b.model + '\nReg: ' + b.reg + '\nTotal: ' + b.total + '\n\n';
    } else {
      reply = reply + 'FREE - ' + lbl + ' - No booking\n\n';
    }
  }
  return reply;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Bot running on port ' + PORT);
});