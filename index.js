const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
const http = require('http');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;
const sessions = {};

let currentQR = null;
let isReady = false;

// Web server — QR kodu göster
const server = http.createServer(async (req, res) => {
  if (req.url === '/') {
    if (isReady) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:50px">
        <h2>✅ WhatsApp Bağlı!</h2>
        <p>Element WhatsApp Bot aktif ve çalışıyor.</p>
      </body></html>`);
    } else if (currentQR) {
      try {
        const qrImage = await qrcode.toDataURL(currentQR);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f0f0">
          <h2>📱 WhatsApp QR Kod</h2>
          <p>WhatsApp → Bağlı Cihazlar → Cihaz Ekle → QR'ı tara</p>
          <img src="${qrImage}" style="width:300px;height:300px;border:10px solid white;border-radius:10px"/>
          <p style="color:gray;font-size:12px">QR kod 60 saniyede yenilenir. Sayfayı yenile.</p>
        </body></html>`);
      } catch (e) {
        res.writeHead(500);
        res.end('QR oluşturulamadı');
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:50px">
        <h2>⏳ Başlatılıyor...</h2>
        <p>Lütfen bekleyin, QR kod hazırlanıyor.</p>
        <script>setTimeout(()=>location.reload(), 3000)</script>
      </body></html>`);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Web sunucu başlatıldı: http://localhost:${PORT}`);
});

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  currentQR = qr;
  console.log('✅ QR KOD HAZIR — Tarayıcıdan aç ve tara!');
});

client.on('ready', () => {
  isReady = true;
  currentQR = null;
  console.log('✅ WhatsApp bağlantısı kuruldu!');
});

client.on('authenticated', () => {
  console.log('✅ Kimlik doğrulandı!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Kimlik doğrulama hatası:', msg);
});

client.on('message', async (message) => {
  if (message.from.endsWith('@g.us')) return;
  if (message.from === 'status@broadcast') return;

  const from = message.from;
  const text = message.body;

  console.log(`📩 Mesaj [${from}]: ${text}`);

  if (!sessions[from]) sessions[from] = [];
  sessions[from].push({ role: 'user', content: text });
  if (sessions[from].length > 16) sessions[from] = sessions[from].slice(-16);

  try {
    const systemPrompt = `Sen Element Toz Boya şirketinin 7/24 AI satış asistanısın. Adın "Element Asistan".

ŞİRKET:
- Element Toz Boya (Element Powder Coating) — Türkiye'nin 5. büyük toz boya üreticisi
- E-ticaret: shopelementboya.com
- Kurumsal: www.elementboya.com
- RAL renk sistemi, PE TGIC / PE HAA / Epoksi / Hybrid serileri
- Fiyatlar kg başına, KDV hariç
- 10.000 TL+ alışverişte ücretsiz kargo

İLETİŞİM BİLGİLERİ:
- Adres: Aydınlı-Birlik OSB Mah. 6. Sok. No:5, 34953 Tuzla İstanbul
- Telefon: +90 216 593 29 80
- E-posta: info@elementboya.com
- Satış: element@elementboya.com

SATIŞ EKİBİ - İSTANBUL:
- Yücel Türkmen: 0533 295 20 92
- Safa Akın Dönmez: 0533 260 31 51 (Anadolu)
- Ersin Çalındır: 0534 861 12 77 (Anadolu)
- Yavuz Selim İyiyazıcı: 0532 173 19 22 (Avrupa)
- Ali Koldaş: 0533 052 80 95 (Avrupa)

SATIŞ EKİBİ - KAYSERİ:
- Tel: 0352 503 11 21
- Musa Dursun: 0533 691 12 09

DOĞRU SAYFALAR:
- İletişim: https://www.elementboya.com/Tr/show/iletisim
- Teknik Veri Sayfaları: https://www.elementboya.com/Tr/show/-teknik-veri-sayfalari
- Ürünler: https://www.elementboya.com/Tr/show/-toz-boya
- Kataloglar: https://www.elementboya.com/Tr/show/kataloglar
- Uygulama Süreci: https://www.elementboya.com/Tr/show/-toz-boya-uygulama-sureci

GENEL KURALLAR:
- Kısa mesajlar (2-4 cümle)
- Doğal, samimi Türkçe
- Emoji: max 1-2
- Rakip tavsiye etme
- Fiyat için shopelementboya.com'a yönlendir
- Link verirken SADECE yukarıdaki doğru linkleri kullan`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        max_tokens: 1024,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...sessions[from]
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiReply = response.data.choices[0].message.content;
    sessions[from].push({ role: 'assistant', content: aiReply });
    await message.reply(aiReply);
    console.log(`📤 Cevap gönderildi`);

  } catch (error) {
    console.error('❌ Hata:', error.message);
    await message.reply('Üzgünüm, şu an teknik bir sorun var. Lütfen shopelementboya.com adresini ziyaret edin veya 0216 593 29 80 numaralı hattı arayın.');
  }
});

client.initialize();
console.log('🚀 Element WhatsApp Bot başlatılıyor...');
