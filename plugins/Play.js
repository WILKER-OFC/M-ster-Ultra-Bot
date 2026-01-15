// commands/play.js
"use strict";

const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { promisify } = require("util");
const { pipeline } = require("stream");
const streamPipe = promisify(pipeline);

// ==== CONFIG DE API ====
const API_BASE = "https://api-adonix.ultraplus.click";
const API_KEY = "Mikeywilker1";

// Defaults
const DEFAULT_AUDIO_FORMAT = "mp3";
const MAX_MB = 99;

// Almacena tareas pendientes por previewMessageId
const pending = {};

// ---------- utils ----------
function safeName(name = "file") {
  return (
    String(name)
      .slice(0, 90)
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "file"
  );
}

function fileSizeMB(filePath) {
  try {
    const b = fs.statSync(filePath).size;
    return b / (1024 * 1024);
  } catch {
    return 0;
  }
}

function ensureTmp() {
  const tmp = path.join(__dirname, "../tmp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

async function downloadToFile(url, filePath) {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "*/*",
    };

    const res = await axios.get(url, {
      responseType: "stream",
      timeout: 180000,
      headers,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (res.status >= 400) {
      throw new Error(`HTTP_${res.status}`);
    }

    await streamPipe(res.data, fs.createWriteStream(filePath));
    return filePath;
  } catch (error) {
    throw new Error(`Error descargando: ${error.message}`);
  }
}

// ---------- API Audio ----------
async function callAudioApi(videoUrl) {
  console.log(`🔍 Llamando API para: ${videoUrl}`);
  
  const endpoint = `${API_BASE}/download/ytaudio`;
  const params = {
    apikey: API_KEY,
    url: videoUrl
  };

  try {
    console.log(`🌐 URL de la API: ${endpoint}?apikey=...&url=${encodeURIComponent(videoUrl)}`);
    
    const r = await axios.get(endpoint, {
      params,
      timeout: 120000,
      headers: {
        "Accept": "application/json, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      validateStatus: (status) => status < 500, // Aceptar códigos 4xx para ver el error
    });

    console.log(`📊 Status: ${r.status}`);
    console.log(`📦 Datos recibidos:`, r.data);

    // Intentar parsear la respuesta de diferentes formas
    let data;
    if (typeof r.data === 'string') {
      try {
        data = JSON.parse(r.data);
      } catch {
        // Si no es JSON, puede ser texto o HTML
        data = { raw: r.data };
      }
    } else {
      data = r.data;
    }

    // Verificar diferentes formatos de respuesta
    if (data.error || data.message || data.status === "error") {
      const errorMsg = data.error || data.message || "Error en la API";
      console.error(`❌ Error API: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Buscar la URL de descarga en diferentes formatos
    let downloadUrl = null;
    if (data.url) downloadUrl = data.url;
    else if (data.download) downloadUrl = data.download;
    else if (data.link) downloadUrl = data.link;
    else if (data.dl) downloadUrl = data.dl;
    else if (data.direct) downloadUrl = data.direct;
    else if (data.result?.url) downloadUrl = data.result.url;
    else if (data.result?.download) downloadUrl = data.result.download;

    if (!downloadUrl && data.raw) {
      // Intentar extraer URL del HTML/texto
      const urlMatch = data.raw.match(/(https?:\/\/[^\s"'<>]+\.(mp3|m4a|webm|opus)[^\s"'<>]*)/i);
      if (urlMatch) downloadUrl = urlMatch[1];
    }

    if (!downloadUrl) {
      console.error("❌ No se encontró URL de descarga en la respuesta:", data);
      throw new Error("No se pudo obtener el enlace de descarga");
    }

    return {
      title: data.title || "YouTube Audio",
      dl_download: downloadUrl,
      thumbnail: data.thumbnail || "",
      format: data.format || DEFAULT_AUDIO_FORMAT,
      duration: data.duration || data.time || "Desconocida"
    };
  } catch (error) {
    console.error(`🔥 Error en callAudioApi:`, error.message);
    if (error.response) {
      console.error(`📊 Response status: ${error.response.status}`);
      console.error(`📊 Response data:`, error.response.data);
    }
    throw new Error(`Error API: ${error.message}`);
  }
}

// ---------- main ----------
module.exports = async (msg, { conn, text }) => {
  const pref = global.prefixes?.[0] || ".";

  if (!text) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: `✳️ Usa:\n${pref}play <término>\nEj: *${pref}play* bad bunny diles` },
      { quoted: msg }
    );
  }

  await conn.sendMessage(msg.key.remoteJid, { react: { text: "⏳", key: msg.key } });

  try {
    console.log(`🔍 Buscando: ${text}`);
    const res = await yts(text.trim());
    const video = res.videos?.[0];
    
    if (!video) {
      await conn.sendMessage(msg.key.remoteJid, { text: "❌ Sin resultados." }, { quoted: msg });
      return;
    }

    const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video;
    const viewsFmt = (views || 0).toLocaleString();

    console.log(`🎬 Video encontrado: ${title}`);
    console.log(`🔗 URL: ${videoUrl}`);

    const caption = `
🎵 M-STER ULTRA BOT

🔹 Duración: ${duration}
🔹 Vistas: ${viewsFmt}
🔹 Autor: ${author?.name || author || "Desconocido"}
🔹 Link: ${videoUrl}

📋 Formato: MP3

Opciones:
• 👍 Audio MP3 (1 / audio)
• 📄 Audio Doc (4 / audiodoc)

⚠️ Solo audio disponible

📞 Azura ultra 2.0 🔥
`.trim();

    const preview = await conn.sendMessage(
      msg.key.remoteJid,
      { image: { url: thumbnail }, caption },
      { quoted: msg }
    );

    pending[preview.key.id] = {
      chatId: msg.key.remoteJid,
      videoUrl,
      title,
      thumbnail,
      commandMsg: msg,
      timestamp: Date.now()
    };

    await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } });

  } catch (error) {
    console.error(`🔥 Error en búsqueda:`, error);
    await conn.sendMessage(
      msg.key.remoteJid, 
      { text: `❌ Error al buscar: ${error.message}` }, 
      { quoted: msg }
    );
  }

  // listener único
  if (!conn._playAudioListener) {
    conn._playAudioListener = true;

    conn.ev.on("messages.upsert", async (ev) => {
      for (const m of ev.messages) {
        if (!m.message) continue;

        // 1) REACCIONES
        if (m.message.reactionMessage) {
          try {
            const { key: reactKey, text: emoji } = m.message.reactionMessage;
            const job = pending[reactKey.id];
            
            if (job && (emoji === "👍" || emoji === "📄")) {
              const isDoc = emoji === "📄";
              await conn.sendMessage(
                job.chatId, 
                { text: `⏳ Descargando audio (mp3)...` }, 
                { quoted: job.commandMsg }
              );
              await downloadAudio(conn, job, isDoc, m);
            }
          } catch (error) {
            console.error("Error procesando reacción:", error);
          }
        }

        // 2) RESPUESTAS CITADAS
        try {
          const context = m.message?.extendedTextMessage?.contextInfo;
          const citado = context?.stanzaId;
          const textoRaw = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
          const texto = String(textoRaw).trim().toLowerCase();

          const job = pending[citado];
          const chatId = m.key.remoteJid;

          if (citado && job) {
            if (["1", "audio", "4", "audiodoc"].includes(texto.split(/\s+/)[0])) {
              const docMode = texto.startsWith("4") || texto.includes("audiodoc");
              await conn.sendMessage(chatId, { react: { text: docMode ? "📄" : "🎵", key: m.key } });
              await conn.sendMessage(
                chatId, 
                { text: `🎶 Descargando audio (mp3)...` }, 
                { quoted: m }
              );
              await downloadAudio(conn, job, docMode, m);
              
              // Limpiar después de 5 minutos
              if (!job._timer) {
                job._timer = setTimeout(() => delete pending[citado], 5 * 60 * 1000);
              }
            } else if (texto) {
              await conn.sendMessage(
                chatId,
                { text: `⚠️ Opciones:\n• 1 o "audio" → audio normal\n• 4 o "audiodoc" → audio como documento` },
                { quoted: m }
              );
            }
          }
        } catch (error) {
          console.error("Error en detector citado:", error);
        }
      }
    });
  }
};

async function downloadAudio(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job;

  console.log(`🎯 Iniciando descarga para: ${title}`);
  console.log(`🔗 URL de video: ${videoUrl}`);

  let resolved;
  try {
    resolved = await callAudioApi(videoUrl);
    console.log(`✅ API response:`, resolved);
  } catch (error) {
    console.error(`❌ Error en API:`, error);
    await conn.sendMessage(
      chatId, 
      { text: `❌ Error en la API: ${error.message}` }, 
      { quoted }
    );
    return;
  }

  const mediaUrl = resolved.dl_download;
  if (!mediaUrl) {
    console.error(`❌ No hay URL de descarga`);
    await conn.sendMessage(chatId, { text: "❌ No se pudo obtener enlace de descarga." }, { quoted });
    return;
  }

  console.log(`⬇️ URL de descarga: ${mediaUrl}`);

  const tmp = ensureTmp();
  const base = safeName(title);
  
  // Limpiar archivos temporales antiguos
  try {
    const files = fs.readdirSync(tmp);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(tmp, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 10 * 60 * 1000) { // 10 minutos
        fs.unlinkSync(filePath);
      }
    });
  } catch {}

  const inFile = path.join(tmp, `${Date.now()}_${base}_raw`);
  let outFile = path.join(tmp, `${Date.now()}_${base}.mp3`);

  try {
    console.log(`⬇️ Descargando archivo...`);
    await downloadToFile(mediaUrl, inFile);
    console.log(`✅ Archivo descargado: ${inFile}`);
    
    // Verificar si el archivo se descargó
    if (!fs.existsSync(inFile) || fs.statSync(inFile).size === 0) {
      throw new Error("Archivo vacío o no descargado");
    }

    // Intentar convertir a MP3
    console.log(`🎵 Convirtiendo a MP3...`);
    await new Promise((resolve, reject) => {
      ffmpeg(inFile)
        .audioCodec("libmp3lame")
        .audioBitrate("192k")
        .format("mp3")
        .on('start', (cmd) => console.log(`FFmpeg comando: ${cmd}`))
        .on('progress', (progress) => console.log(`Progreso: ${progress.percent}%`))
        .on('end', () => {
          console.log(`✅ Conversión completada`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`❌ Error FFmpeg:`, err);
          reject(err);
        })
        .save(outFile);
    });

    // Limpiar archivo temporal
    try { fs.unlinkSync(inFile); } catch {}

  } catch (error) {
    console.error(`❌ Error en procesamiento:`, error);
    
    // Si falla la conversión, usar el archivo original
    if (fs.existsSync(inFile)) {
      outFile = inFile;
      asDocument = true;
    } else {
      await conn.sendMessage(
        chatId, 
        { text: `❌ Error al procesar audio: ${error.message}` }, 
        { quoted }
      );
      return;
    }
  }

  // Verificar tamaño
  if (!fs.existsSync(outFile)) {
    await conn.sendMessage(chatId, { text: "❌ Error: Archivo no encontrado después de procesar." }, { quoted });
    return;
  }

  const sizeMB = fileSizeMB(outFile);
  console.log(`📊 Tamaño del archivo: ${sizeMB.toFixed(2)}MB`);
  
  if (sizeMB > MAX_MB) {
    try { fs.unlinkSync(outFile); } catch {}
    await conn.sendMessage(
      chatId, 
      { text: `❌ El audio pesa ${sizeMB.toFixed(2)}MB (límite: ${MAX_MB}MB).` }, 
      { quoted }
    );
    return;
  }

  // Enviar audio
  try {
    console.log(`📤 Enviando audio...`);
    await conn.sendMessage(
      chatId,
      {
        [asDocument ? "document" : "audio"]: fs.readFileSync(outFile),
        mimetype: "audio/mpeg",
        fileName: `${base}.mp3`,
      },
      { quoted }
    );
    console.log(`✅ Audio enviado exitosamente`);
  } catch (sendError) {
    console.error(`❌ Error al enviar:`, sendError);
    await conn.sendMessage(
      chatId, 
      { text: `❌ Error al enviar audio: ${sendError.message}` }, 
      { quoted }
    );
  }

  // Limpiar archivo temporal
  try { 
    fs.unlinkSync(outFile); 
    console.log(`🧹 Archivo temporal eliminado`);
  } catch {}
}

module.exports.command = ["play"];