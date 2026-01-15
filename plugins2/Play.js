const yts = require('yt-search');
const axios = require('axios');

const MAX_SECONDS = 90 * 60;
const HTTP_TIMEOUT_MS = 90 * 1000;

function parseDurationToSeconds(d) {
  if (d == null) return null;
  if (typeof d === 'number' && Number.isFinite(d)) return Math.max(0, Math.floor(d));
  const s = String(d).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10));
  const parts = s.split(':').map((x) => x.trim()).filter(Boolean);
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + parseInt(p, 10);
  return Number.isFinite(sec) ? sec : null;
}

function formatErr(err, maxLen = 1500) {
  const e = err ?? 'Error desconocido';
  let msg = '';

  if (e instanceof Error) msg = e.stack || `${e.name}: ${e.message}`;
  else if (typeof e === 'string') msg = e;
  else {
    try {
      msg = JSON.stringify(e, null, 2);
    } catch {
      msg = String(e);
    }
  }

  msg = String(msg || 'Error desconocido').trim();
  if (msg.length > maxLen) msg = msg.slice(0, maxLen) + '\n... (recortado)';
  return msg;
}

async function fetchJson(url, timeoutMs = HTTP_TIMEOUT_MS) {
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      headers: { 
        accept: 'application/json', 
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
      validateStatus: function (status) {
        return status < 500;
      }
    });

    console.log(`📊 Status API: ${res.status}`);

    if (!res.data) throw new Error('Respuesta vacía de la API');

    let data = res.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return { raw: data };
      }
    }

    return data;
  } catch (error) {
    console.error(`🔥 Error en fetchJson:`, error.message);

    if (error.response) {
      let errorMsg = `HTTP ${error.response.status}`;
      if (error.response.data) {
        if (typeof error.response.data === 'object') {
          errorMsg += `: ${error.response.data.error || error.response.data.message || JSON.stringify(error.response.data).slice(0, 200)}`;
        } else {
          errorMsg += `: ${String(error.response.data).slice(0, 200)}`;
        }
      }
      throw new Error(errorMsg);
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout: La API no respondió a tiempo');
    }

    throw new Error(`Error de conexión: ${error.message}`);
  }
}

async function fetchBuffer(url, timeoutMs = HTTP_TIMEOUT_MS) {
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      responseType: 'arraybuffer',
      headers: { 
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
      },
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024
    });

    if (!res.data || res.data.length === 0) {
      throw new Error('Archivo vacío recibido');
    }

    console.log(`✅ Archivo descargado: ${(res.data.length / (1024 * 1024)).toFixed(2)}MB`);
    return Buffer.from(res.data);
  } catch (error) {
    console.error(`🔥 Error en fetchBuffer:`, error.message);

    if (error.response) {
      throw new Error(`No se pudo descargar el audio (HTTP ${error.response.status})`);
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout al descargar el audio');
    }

    throw new Error(`Error de descarga: ${error.message}`);
  }
}

function guessMimeFromUrl(fileUrl = '') {
  let ext = '';
  try {
    ext = new URL(fileUrl).pathname.split('.').pop() || '';
  } catch {
    ext = String(fileUrl).split('.').pop() || '';
  }
  ext = '.' + String(ext).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.opus') return 'audio/ogg; codecs=opus';
  if (ext === '.webm') return 'audio/webm';
  return 'audio/mpeg';
}

function safeFileName(name = 'audio') {
  return String(name)
    .slice(0, 90)
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'audio';
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const chatId = m?.chat || m?.key?.remoteJid;
  if (!chatId) return;

  if (!text) {
    return conn.sendMessage(
      chatId,
      { text: `🎵 Usa: *${usedPrefix + command} <nombre o link>*\nEj: *${usedPrefix}play* bad bunny` },
      { quoted: m }
    );
  }

  await conn.sendMessage(chatId, { react: { text: '🕒', key: m.key } }).catch(() => {});

  let ytUrl = text.trim();
  let ytInfo = null;

  try {
    console.log(`🔍 Buscando: ${text}`);

    if (!/youtu\.be|youtube\.com/i.test(ytUrl)) {
      const search = await yts(ytUrl);
      const first = search?.videos?.[0];
      if (!first) {
        await conn.sendMessage(chatId, { text: '❌ No se encontraron resultados.' }, { quoted: m });
        return;
      }
      ytInfo = first;
      ytUrl = first.url;
    } else {
      const search = await yts({ query: ytUrl, pages: 1 });
      if (search?.videos?.length) ytInfo = search.videos[0];
    }

    console.log(`✅ Encontrado: ${ytInfo?.title}`);
    console.log(`🔗 URL: ${ytUrl}`);
  } catch (e) {
    console.error('Error buscando:', e);
    await conn.sendMessage(
      chatId,
      { text: `❌ Error buscando en YouTube.\n\nError: ${formatErr(e).slice(0, 500)}` },
      { quoted: m }
    );
    return;
  }

  const durSec =
    parseDurationToSeconds(ytInfo?.duration?.seconds) ??
    parseDurationToSeconds(ytInfo?.seconds) ??
    parseDurationToSeconds(ytInfo?.duration) ??
    parseDurationToSeconds(ytInfo?.timestamp);

  if (durSec && durSec > MAX_SECONDS) {
    await conn.sendMessage(
      chatId,
      { text: `❌ Audio muy largo.\nMáximo: ${Math.floor(MAX_SECONDS / 60)} minutos.` },
      { quoted: m }
    );
    return;
  }

  const title = ytInfo?.title || 'Audio';
  const author = ytInfo?.author?.name || ytInfo?.author || 'Desconocido';
  const duration = ytInfo?.timestamp || 'Desconocida';
  const thumbnail = ytInfo?.thumbnail;
  const views = ytInfo?.views || 0;

  const caption =
    `🎵 *M-STER ULTRA BOT SUBBOT*\n\n` +
    `📀 *Información:*\n` +
    `• *Título:* ${title}\n` +
    `• *Duración:* ${duration}\n` +
    `• *Vistas:* ${views.toLocaleString()}\n` +
    `• *Autor:* ${author}\n` +
    `• *Link:* ${ytUrl}\n\n` +
    `📋 *Formato:* MP3\n\n` +
    `⏳ *Descargando audio...*`;

  try {
    if (thumbnail) {
      await conn.sendMessage(chatId, { image: { url: thumbnail }, caption }, { quoted: m });
    } else {
      await conn.sendMessage(chatId, { text: caption }, { quoted: m });
    }
  } catch (e) {
    console.error('Error enviando preview:', e);
  }

  // Configuración de la API
  const API_KEY = 'Mikeywilker1';
  const API_BASE = 'https://api-adonix.ultraplus.click';

  let apiResp = null;
  try {
    const apiUrl = `${API_BASE}/download/ytaudio`;
    const params = {
      apikey: API_KEY,
      url: ytUrl
    };

    console.log(`🌐 Llamando API...`);
    console.log(`URL: ${apiUrl}`);

    apiResp = await fetchJson(`${apiUrl}?apikey=${encodeURIComponent(API_KEY)}&url=${encodeURIComponent(ytUrl)}`, HTTP_TIMEOUT_MS);

    console.log(`✅ Respuesta API recibida`);
  } catch (e) {
    console.error('Error en la API:', e);
    await conn.sendMessage(
      chatId,
      { text: `❌ Error con la API de audio.\n\nError: ${formatErr(e).slice(0, 500)}` },
      { quoted: m }
    );
    return;
  }

  // Manejar diferentes formatos de respuesta
  let directUrl = null;
  let apiTitle = title;

  // Intentar extraer la URL de descarga
  if (apiResp?.url) {
    directUrl = apiResp.url;
    apiTitle = apiResp.title || title;
  } else if (apiResp?.data?.url) {
    directUrl = apiResp.data.url;
    apiTitle = apiResp.data.title || title;
  } else if (apiResp?.download) {
    directUrl = apiResp.download;
    apiTitle = apiResp.title || title;
  } else if (apiResp?.link) {
    directUrl = apiResp.link;
    apiTitle = apiResp.title || title;
  } else if (apiResp?.result?.url) {
    directUrl = apiResp.result.url;
    apiTitle = apiResp.result.title || title;
  } else if (apiResp?.dl) {
    directUrl = apiResp.dl;
    apiTitle = apiResp.title || title;
  } else if (apiResp?.direct) {
    directUrl = apiResp.direct;
    apiTitle = apiResp.title || title;
  } else if (typeof apiResp === 'string' && apiResp.startsWith('http')) {
    directUrl = apiResp;
  } else if (apiResp?.raw && typeof apiResp.raw === 'string') {
    const urlMatch = apiResp.raw.match(/(https?:\/\/[^\s"'<>]+\.(mp3|m4a|opus|webm)[^\s"'<>]*)/i);
    if (urlMatch) {
      directUrl = urlMatch[1];
    }
  }

  if (!directUrl) {
    console.error('❌ No se pudo extraer URL:', apiResp);
    await conn.sendMessage(
      chatId,
      { text: `❌ La API no devolvió un link válido.\nRespuesta: ${JSON.stringify(apiResp || 'Vacío').slice(0, 500)}` },
      { quoted: m }
    );
    return;
  }

  console.log(`✅ URL de descarga: ${directUrl}`);
  console.log(`📝 Título: ${apiTitle}`);

  try {
    await conn.sendMessage(
      chatId,
      { text: `Audio descargado con éxito ✅.` },
      { quoted: m }
    );

    const audioBuffer = await fetchBuffer(directUrl, HTTP_TIMEOUT_MS * 2);

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('El audio descargado está vacío');
    }

    const mime = guessMimeFromUrl(directUrl);
    const fileName = `${safeFileName(apiTitle)}.mp3`;

    console.log(`✅ Audio listo: ${(audioBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

    await conn.sendMessage(
      chatId,
      {
        audio: audioBuffer,
        mimetype: mime,
        fileName: fileName
      },
      { quoted: m }
    );

    console.log(`✅ Audio enviado exitosamente`);

    await conn.sendMessage(chatId, { react: { text: '✅', key: m.key } }).catch(() => {});

  } catch (e) {
    console.error('Error procesando audio:', e);
    await conn.sendMessage(
      chatId,
      { text: `❌ Error al procesar el audio.\n\nError: ${formatErr(e).slice(0, 500)}` },
      { quoted: m }
    );
  }
};

handler.help = ['play <texto|link>'];
handler.tags = ['multimedia'];
handler.command = ['play'];

module.exports = handler;