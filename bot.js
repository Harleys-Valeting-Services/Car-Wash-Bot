const express = require('express');
const app = express();
app.use(express.json());

const TOKEN = '8705581943:AAGSyEKXdishm0GBVYbE60sXeqYuRaeRLLI';
const CHAT_ID = '7248045188';
const TELEGRAM_API = 'https://api.telegram.org/bot' + TOKEN;
const ANTHROPIC_KEY = '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';

let bookings = {};
let blocked = {};

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.message;
  if (!msg) return;
  if (String(msg.chat.id) !== CHAT_ID) return;
  const userText = (msg.text || '').trim();
  if (!userText) return;
  try {
    const reply = await askClaude(userText);
    await sendTelegram(reply);
  } catch (err) {
    console.error('Error:', err);
    await sendTelegram('Sorry, something went wrong. Please try again!');
  }
});

async function askClaude(userMessage) {
  const today = new Date().toISOString().split('T')[0];
  const todayFriendly = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totalRaised = Object.keys(bookings).length * 20;
  const progress = Math.round((totalRaised / 4600) * 100);
  const bookingsSummary = buildBookingsSummary();
  const blockedSummary = buildBlockedSummary();

  const systemPrompt = 'You are a helpful assistant managing a school car wash fundraiser for a Kenya trip in 2027. You are chatting with the organiser via Telegram.\n\nABOUT THE CAR WASH:\n- Price: £20 per wash (exterior only)\n- Tips accepted, 100% goes to Kenya fund\n- Goal: raise £4,600\n- Time: 3:00 PM - 4:00 PM daily\n- Days: Monday to Thursday only\n- Location: Bike Lockup, Next to the Barrier\n- Only 1 car per day\n\nTODAY: ' + todayFriendly + ' (' + today + ')\n\nCURRENT BOOKINGS:\n' + bookingsSummary + '\n\nBLOCKED DATES:\n' + blockedSummary + '\n\nTOTAL RAISED: £' + totalRaised + '\nNUMBER OF BOOKINGS: ' + Object.keys(bookings).length + '\nPROGRESS TO GOAL: ' + progress + '%\n\nYOUR JOB:\n- Answer any questions about bookings, schedules, money raised\n- Tell the organiser who is booked on specific days or weeks\n- Check if dates are free or blocked\n- Draft custom receipts if asked\n- Be friendly, concise and use emojis\n- Keep replies short and scannable for Telegram\n- Format dates like Monday 9th March\n- Always use British pounds with the pound sign\n- If asked to block a date tell them to use the admin panel on their Netlify site';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('Anthropic error:', JSON.stringify(data.error));
    return 'Sorry, I could not process that. Please try again!';
  }
  if (!data.content || !data.content[0]) {
    console.error('Unexpected response:', JSON.stringify(data));
    return 'Sorry, I got an unexpected response. Please try again!';
  }
  return data.content[0].text;
}

function buildBookingsSummary() {
  const dates = Object.keys(bookings).sort();
  if (dates.length === 0) return 'No bookings yet.';
  return dates.map(function(d) {
    const b = bookings[d];
    const friendly = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return friendly + ': ' + b.name + ' | ' + b.make + ' ' + b.model + ' | Reg: ' + b.reg + ' | Total: ' + b.total + ' | Email: ' + b.email;
  }).join('\n');
}

function buildBlockedSummary() {
  const dates = Object.keys(blocked).sort();
  if (dates.length === 0) return 'No blocked dates.';
  return dates.map(function(d) {
    const friendly = new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return friendly + ': ' + blocked[d].reason;
  }).join('\n');
}

async function sendTelegram(text) {
  await fetch(TELEGRAM_API + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: text })
  });
}

app.post('/newbooking', (req, res) => {
  const b = req.body;
  if (b.date) {
    bookings[b.date] = { name: b.name, email: b.email, make: b.make, model: b.model, reg: b.reg, tip: b.tip, total: b.total };
  }
  res.sendStatus(200);
});

app.post('/updateblocked', (req, res) => {
  blocked = req.body.blocked || {};
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('AI Bot running on port ' + PORT);
});
