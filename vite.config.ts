import { defineConfig } from 'vite';

const RU_MONTHS: Record<string, number> = {
  'янв': 1, 'января': 1, 'январь': 1,
  'фев': 2, 'февр': 2, 'февраля': 2, 'февраль': 2,
  'мар': 3, 'марта': 3, 'март': 3,
  'апр': 4, 'апреля': 4, 'апрель': 4,
  'май': 5, 'мая': 5,
  'июн': 6, 'июня': 6, 'июнь': 6,
  'июл': 7, 'июля': 7, 'июль': 7,
  'авг': 8, 'августа': 8, 'август': 8,
  'сен': 9, 'сент': 9, 'сентября': 9, 'сентябрь': 9,
  'окт': 10, 'октября': 10, 'октябрь': 10,
  'ноя': 11, 'нояб': 11, 'ноября': 11, 'ноябрь': 11,
  'дек': 12, 'декабря': 12, 'декабрь': 12
};

const EN_MONTHS: Record<string, number> = {
  'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
  'apr': 4, 'april': 4, 'may': 5, 'june': 6, 'jul': 7, 'july': 7,
  'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
  'nov': 11, 'november': 11, 'dec': 12, 'december': 12
};

function parseDateText(str: string): string | null {
  if (!str) return null;

  // 1. ISO YYYY-MM-DD
  const isoMatch = str.match(/(20\d\d)-([01]\d)-([03]\d)/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // 2. DD.MM.YYYY
  const dotMatch = str.match(/([0-3]?\d)\.([01]?\d)\.(20\d\d)/);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    return `${dotMatch[3]}-${month}-${day}`;
  }

  // 3. Russian date: "28 февр. 2019" or "28 февраля 2019"
  const ruMatch = str.match(/([0-3]?\d)\s+([а-яяА-Я]+)\.?\s+(20\d\d)/i);
  if (ruMatch) {
    const day = ruMatch[1].padStart(2, '0');
    const mStr = ruMatch[2].toLowerCase().trim().replace('.', '');
    const mNum = RU_MONTHS[mStr];
    if (mNum) {
      const month = String(mNum).padStart(2, '0');
      return `${ruMatch[3]}-${month}-${day}`;
    }
  }

  // 4. English date: "Feb 28, 2019"
  const enMatch = str.match(/([a-z]+)\s+([0-3]?\d),?\s+(20\d\d)/i);
  if (enMatch) {
    const mStr = enMatch[1].toLowerCase().trim();
    const mNum = EN_MONTHS[mStr];
    if (mNum) {
      const day = enMatch[2].padStart(2, '0');
      const month = String(mNum).padStart(2, '0');
      return `${enMatch[3]}-${month}-${day}`;
    }
  }

  return null;
}

const MONTHS_RU_ARR = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const MONTHS_SHORT_RU_ARR = [
  'янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.',
  'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'
];

function formatDateRu(isoStr: string) {
  if (!isoStr) return '';
  const match = isoStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoStr;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (monthIdx >= 0 && monthIdx < 12) {
    const full = `${day} ${MONTHS_RU_ARR[monthIdx]} ${year}`;
    const short = `${day} ${MONTHS_SHORT_RU_ARR[monthIdx]} ${year}`;
    return { full, short, day, month: monthIdx + 1, year };
  }
  return { full: isoStr, short: isoStr, day: '', month: '', year: '' };
}

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  plugins: [
    {
      name: 'video-info-api',
      configureServer(server) {
        server.middlewares.use('/api/video-info', async (req, res) => {
          try {
            const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
            const videoUrl = reqUrl.searchParams.get('url');

            if (!videoUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing url parameter' }));
              return;
            }

            let dateIso = '';
            let videoTitle = '';
            let platform = 'unknown';

            // Extract YouTube ID
            const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/i) || videoUrl.match(/[?&]v=([\w-]{11})/i);
            const ytId = ytMatch ? ytMatch[1] : (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl.trim()) ? videoUrl.trim() : null);

            if (ytId) {
              platform = 'youtube';
              try {
                const response = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                  }
                });
                const html = await response.text();

                // Title
                const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                  videoTitle = titleMatch[1].replace(' - YouTube', '').trim();
                }

                const candidates: string[] = [];

                // 1. Direct itemprop or meta content
                const metaUpload = html.match(/itemprop="uploadDate"\s+content="([^"]+)"/i);
                if (metaUpload) candidates.push(metaUpload[1]);

                const metaPub = html.match(/itemprop="datePublished"\s+content="([^"]+)"/i);
                if (metaPub) candidates.push(metaPub[1]);

                // 2. JSON uploadDate / publishDate
                const jsonUpload = html.match(/"uploadDate"\s*:\s*"([^"]+)"/i);
                if (jsonUpload) candidates.push(jsonUpload[1]);

                const jsonPub = html.match(/"publishDate"\s*:\s*"([^"]+)"/i);
                if (jsonPub) candidates.push(jsonPub[1]);

                // 3. dateText simpleText (streams, premieres, archived broadcasts)
                const dateTextM = html.match(/"dateText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"\s*\}/i);
                if (dateTextM) candidates.push(dateTextM[1]);

                // 4. Any simpleText containing a 4-digit year
                const simpleTexts = html.match(/"simpleText"\s*:\s*"([^"]*(?:20\d\d|19\d\d)[^"]*)"/gi) || [];
                for (const st of simpleTexts) {
                  const m = st.match(/"simpleText"\s*:\s*"([^"]+)"/i);
                  if (m) candidates.push(m[1]);
                }

                for (const cand of candidates) {
                  const parsed = parseDateText(cand);
                  if (parsed) {
                    dateIso = parsed;
                    break;
                  }
                }
              } catch (err) {
                console.error('Error fetching YouTube metadata:', err);
              }

              // Fallback to oEmbed for title
              if (!videoTitle) {
                try {
                  const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
                  if (oembedRes.ok) {
                    const oembedData = await oembedRes.json();
                    if (oembedData.title) videoTitle = oembedData.title;
                  }
                } catch (e) {}
              }
            } else if (videoUrl.includes('vk.com') || videoUrl.includes('vkvideo.ru')) {
              platform = 'vk';
              try {
                const response = await fetch(videoUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const html = await response.text();
                const candMatch = html.match(/itemprop="uploadDate"\s+content="([^"]+)"/i) || html.match(/"uploadDate"\s*:\s*"([^"]+)"/i) || html.match(/\b(20\d\d-[01]\d-[03]\d)\b/);
                if (candMatch) {
                  const parsed = parseDateText(candMatch[1]);
                  if (parsed) dateIso = parsed;
                }
              } catch (e) {}
            } else if (videoUrl.includes('twitch.tv')) {
              platform = 'twitch';
              try {
                const response = await fetch(videoUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const html = await response.text();
                const candMatch = html.match(/itemprop="uploadDate"\s+content="([^"]+)"/i) || html.match(/"uploadDate"\s*:\s*"([^"]+)"/i) || html.match(/"created_at"\s*:\s*"([^"]+)"/i);
                if (candMatch) {
                  const parsed = parseDateText(candMatch[1]);
                  if (parsed) dateIso = parsed;
                }
              } catch (e) {}
            }

            const formatted = formatDateRu(dateIso);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: !!dateIso,
              platform,
              dateIso,
              dateFormatted: typeof formatted === 'object' ? formatted.full : formatted,
              dateFormattedShort: typeof formatted === 'object' ? formatted.short : formatted,
              title: videoTitle
            }));

          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Server error parsing video info' }));
          }
        });
      }
    }
  ]
});

