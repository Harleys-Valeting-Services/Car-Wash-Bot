const express = require('express');
const app = express();
app.use(express.json());

const TOKEN = '8705581943:AAGSyEKXdishm0GBVYbE60sXeqYuRaeRLLI';
const CHAT_ID = '7248045188';
const TELEGRAM_API = 'https://api.telegram.org/bot' + TOKEN;
const GROQ_KEY = process.env.GROQ_KEY;

let bookings = {};
let blocked = {};

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.message;
  if (!msg) return;
  const chatId = String(msg.chat.id);
  const userText = (msg.text || '').trim();
  if (!userText) return;
  // In groups, only respond if the bot is mentioned or message starts with /
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const botUsername = '@BookingssBot';
  if (isGroup && !userText.includes(botUsername) && !userText.startsWith('/')) return;
  // Strip bot mention from message
  const cleanText = userText.replace(botUsername, '').trim();
  try {
    const reply = await askGroq(cleanText);
    await sendTelegramTo(chatId, reply);
  } catch (err) {
    console.error('Caught error:', err.message);
    await sendTelegramTo(chatId, 'Sorry, something went wrong. Please try again!');
  }
});

async function askGroq(userMessage) {
  if (!GROQ_KEY) {
    console.error('No GROQ_KEY set in environment');
    return 'Bot is not configured correctly. Please contact the admin.';
  }

  const today = new Date().toISOString().split('T')[0];
  const todayFriendly = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totalRaised = Object.keys(bookings).length * 20;
  const progress = Math.round((totalRaised / 4600) * 100);
  const bookingsSummary = buildBookingsSummary();
  const blockedSummary = buildBlockedSummary();

  const systemPrompt = 'You are a helpful assistant managing a school car wash fundraiser for a Kenya trip in 2027. You are chatting with the organiser via Telegram.\n\nABOUT THE CAR WASH:\n- Price: £20 per wash (exterior only)\n- Tips accepted, 100% goes to Kenya fund\n- Goal: raise £4,600\n- Time: 3:00 PM - 4:00 PM daily\n- Days: Monday to Thursday only\n- Location: Bike Lockup, Next to the Barrier\n- Only 1 car per day\n\nTODAY: ' + todayFriendly + ' (' + today + ')\n\nCURRENT BOOKINGS:\n' + bookingsSummary + '\n\nBLOCKED DATES:\n' + blockedSummary + '\n\nTOTAL RAISED: £' + totalRaised + '\nNUMBER OF BOOKINGS: ' + Object.keys(bookings).length + '\nPROGRESS TO GOAL: ' + progress + '%\n\nYOUR JOB:\n- Answer any questions about bookings, schedules, money raised\n- Tell the organiser who is booked on specific days or weeks\n- Check if dates are free or blocked\n- Draft custom receipts if asked\n- Be friendly, concise and use emojis\n- Keep replies short and scannable for Telegram\n- Format dates like Monday 9th March\n- Always use British pounds with the pound sign\n- If asked to block a date tell them to use the admin panel on their Netlify site';

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });
  } catch (fetchErr) {
    console.error('Fetch to Groq failed:', fetchErr.message);
    return 'Could not reach the AI service. Please try again in a moment!';
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonErr) {
    console.error('Failed to parse Groq response:', jsonErr.message);
    return 'Got an unexpected response. Please try again!';
  }

  console.log('Groq status:', response.status);

  if (data.error) {
    console.error('Groq API error:', JSON.stringify(data.error));
    return 'The AI service returned an error: ' + data.error.message;
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('Unexpected Groq response:', JSON.stringify(data));
    return 'Got an unexpected response. Please try again!';
  }

  return data.choices[0].message.content;
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
  return sendTelegramTo(CHAT_ID, text);
}

async function sendTelegramTo(chatId, text) {
  try {
    await fetch(TELEGRAM_API + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
  } catch (err) {
    console.error('Failed to send Telegram message:', err.message);
  }
}

app.post('/newbooking', (req, res) => {
  const b = req.body;
  if (b.date) {
    bookings[b.date] = { name: b.name, email: b.email, make: b.make, model: b.model, reg: b.reg, tip: b.tip, total: b.total };
    console.log('New booking saved for:', b.date, b.name);
  }
  res.sendStatus(200);
});

app.post('/updateblocked', (req, res) => {
  blocked = req.body.blocked || {};
  console.log('Blocked dates updated:', Object.keys(blocked).length, 'dates');
  res.sendStatus(200);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bookings: Object.keys(bookings).length,
    blocked: Object.keys(blocked).length,
    hasGroqKey: !!GROQ_KEY
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('AI Bot running on port ' + PORT);
  console.log('GROQ_KEY set:', !!GROQ_KEY);
});
