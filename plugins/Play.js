// commands/play.js - VERSIÓN CORREGIDA
"use strict";

const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");

// APIs para descargar audio
const DOWNLOAD_APIS = [
  {
    name: "api-adonix",
    url: "https://api-adonix.ultraplus.click/download/ytaudio",
    requiresKey: true,
    key: "Mikeywilker1"
  },
  {
    name: "ytmp3",
    url: "https://ytmp3.xyz/api/convert",
    requiresKey: false
  },
  {
    name: "onlinevideoconverter",
    url: "https://api.onlinevideoconverter.pro/api/convert",
    requiresKey: false
  }
];

// ===== FUNCIONES CORREGIDAS =====

// Función para extraer texto del mensaje CORREGIDA
function getMessageText(message) {
  if (!message) return "";
  
  // Si es texto simple
  if (typeof message === "string") return message;
  
  // Si viene en formato de objeto de WhatsApp
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.message?.conversation) return message.message.conversation;
  
  return "";
}

async function getAudioUrl(videoUrl) {
  // Intentar con cada API
  for (const api of DOWNLOAD_APIS) {
    try {
      console.log(`Probando API: ${api.name}`);
      
      let response;
      const params = new URLSearchParams();
      
      if (api.name === "api-adonix") {
        // Tu API personal
        params.append("apikey", api.key);
        params.append("url", videoUrl);
        response = await axios.post(api.url, params.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10000
        });
      } 
      else if (api.name === "ytmp3") {
        // API ytmp3
        params.append("format", "mp3");
        params.append("url", videoUrl);
        response = await axios.post(api.url, params.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10000
        });
      }
      else {
        // Otras APIs
        response = await axios.get(`${api.url}?url=${encodeURIComponent(videoUrl)}`, {
          timeout: 10000
        });
      }
      
      // Intentar extraer URL de diferentes formatos de respuesta
      const data = response.data;
      
      if (data && data.url) return data.url;
      if (data && data.downloadUrl) return data.downloadUrl;
      if (data && data.link) return data.link;
      if (data && typeof data === "string" && data.startsWith("http")) return data;
      
    } catch (error) {
      console.log(`API ${api.name} falló:`, error.message);
      continue; // Intentar con la siguiente API
    }
  }
  
  // Si todas fallan, usar servicio alternativo
  try {
    const fallback = await axios.get(`https://api.tiklydown.eu.org/api/download/audio?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 10000
    });
    if (fallback.data && fallback.data.url) return fallback.data.url;
  } catch (error) {
    console.log("Fallback también falló");
  }
  
  return null;
}

async function downloadAndSendAudio(conn, chatId, videoInfo, quotedMsg) {
  try {
    // Obtener URL de descarga
    const audioUrl = await getAudioUrl(videoInfo.url);
    
    if (!audioUrl) {
      throw new Error("No se pudo obtener el enlace de audio");
    }
    
    // Descargar audio
    const tmpDir = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const fileName = `audio_${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);
    
    const response = await axios({
      method: "GET",
      url: audioUrl,
      responseType: "stream",
      timeout: 60000
    });
    
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
    
    // Verificar tamaño
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    if (fileSize > 50 * 1024 * 1024) { // 50MB límite
      fs.unlinkSync(filePath);
      throw new Error("El audio es demasiado grande (>50MB)");
    }
    
    // Enviar audio
    await conn.sendMessage(chatId, {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${videoInfo.title.substring(0, 50)}.mp3`
    }, { quoted: quotedMsg });
    
    // Limpiar
    fs.unlinkSync(filePath);
    
  } catch (error) {
    throw error;
  }
}

// ===== MANEJADOR PRINCIPAL CORREGIDO =====
module.exports = async (msg, { conn }) => {
  try {
    const chatId = msg.key.remoteJid;
    
    // EXTRAER TEXTO CORRECTAMENTE
    const rawText = getMessageText(msg.message || msg);
    
    if (!rawText) {
      return conn.sendMessage(chatId, {
        text: "❌ No se pudo leer el mensaje"
      }, { quoted: msg });
    }
    
    // DETECTAR COMANDO .play
    const prefix = ".";
    let query = "";
    
    if (rawText.startsWith(`${prefix}play `)) {
      query = rawText.slice(`${prefix}play `.length).trim();
    } else if (rawText.startsWith("play ")) {
      query = rawText.slice("play ".length).trim();
    } else if (rawText.startsWith(".p ")) {
      query = rawText.slice(".p ".length).trim();
    }
    
    // Si no se detectó comando, salir
    if (!query) {
      return conn.sendMessage(chatId, {
        text: `🎵 *USO:* ${prefix}play <nombre de la canción>\n\nEjemplo: ${prefix}play bad bunny`
      }, { quoted: msg });
    }
    
    // Enviar mensaje de procesamiento
    await conn.sendMessage(chatId, {
      text: `🔍 Buscando: "${query}"...`
    }, { quoted: msg });
    
    // Buscar en YouTube
    const searchResult = await yts(query);
    const video = searchResult.videos[0];
    
    if (!video) {
      return conn.sendMessage(chatId, {
        text: "❌ No se encontraron resultados"
      }, { quoted: msg });
    }
    
    // Información del video
    const videoInfo = {
      title: video.title,
      url: video.url,
      duration: video.timestamp || "Desconocida",
      thumbnail: video.thumbnail
    };
    
    // Enviar información
    await conn.sendMessage(chatId, {
      text: `✅ *Encontrado:* ${videoInfo.title}\n⏱️ Duración: ${videoInfo.duration}\n\n⬇️ Descargando audio...`
    }, { quoted: msg });
    
    // Descargar y enviar audio
    await downloadAndSendAudio(conn, chatId, videoInfo, msg);
    
    // Mensaje de éxito
    await conn.sendMessage(chatId, {
      text: `🎵 *Listo!* Disfruta de: ${videoInfo.title}`
    });
    
  } catch (error) {
    console.error("Error en comando play:", error);
    
    await conn.sendMessage(msg.key.remoteJid, {
      text: `❌ Error: ${error.message || "Ocurrió un problema"}`
    }, { quoted: msg });
  }
};

// Configuración del comando
module.exports.command = ["play", "p"];
module.exports.help = "Descarga audio de YouTube | .play <nombre de la canción>";