// commands/play.js - Versión simplificada y automática
"use strict";

const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");

// Tu API principal (con API Key personal)
const USER_API = "https://api-adonix.ultraplus.click/download/ytaudio";

// APIs públicas de respaldo (sin API Key requerida)
const BACKUP_APIS = [
  "https://api.download-lagu-mp3.com/@api/button/mp3", // Soporta: ?url=YOUTUBE_URL
  "https://convert2mp3s.com/api/widgetv2",             // Soporta: ?url=YOUTUBE_URL
  "https://api.vevioz.com/api/button/mp3",             // Soporta: ?url=YOUTUBE_URL
];

// Configuración
const MAX_FILE_SIZE_MB = 50;
const API_TIMEOUT = 30000; // 30 segundos

// ===== FUNCIONES PRINCIPALES =====

async function searchYouTube(query) {
  try {
    const searchResults = await yts(query);
    return searchResults.videos[0]; // Devuelve el primer resultado
  } catch (error) {
    console.error("Error en búsqueda YouTube:", error);
    return null;
  }
}

async function downloadAudioFromAPI(videoUrl, apiUrl, apiKey = null) {
  try {
    const params = new URLSearchParams();
    
    // Construir parámetros según la API
    if (apiUrl.includes('api-adonix')) {
      // Tu API personal - requiere apikey y url
      params.append('apikey', apiKey || 'Mikeywilker1');
      params.append('url', videoUrl);
    } else if (apiUrl.includes('download-lagu-mp3.com') || apiUrl.includes('vevioz.com')) {
      // APIs con formato ?url=VIDEO_URL
      params.append('url', videoUrl);
    } else if (apiUrl.includes('convert2mp3s.com')) {
      // API con formato específico
      params.append('url', videoUrl);
      params.append('format', 'mp3');
    }
    
    const fullUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    
    console.log(`Intentando con API: ${fullUrl}`);
    
    const response = await axios.get(fullUrl, {
      timeout: API_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*'
      }
    });
    
    // Diferentes formatos de respuesta de API
    let audioUrl = null;
    const data = response.data;
    
    // Intentar extraer URL de audio de diferentes formatos de respuesta
    if (data.downloadUrl || data.url) {
      audioUrl = data.downloadUrl || data.url;
    } else if (data.link) {
      audioUrl = data.link;
    } else if (data.result?.url) {
      audioUrl = data.result.url;
    } else if (typeof data === 'string' && data.includes('http')) {
      // Buscar URLs en respuestas de texto
      const urlMatch = data.match(/https?:\/\/[^\s"'<>]+\.(mp3|m4a)/i);
      if (urlMatch) audioUrl = urlMatch[0];
    }
    
    return audioUrl;
    
  } catch (error) {
    console.error(`Error con API ${apiUrl}:`, error.message);
    return null;
  }
}

async function downloadFile(audioUrl, filePath) {
  try {
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      timeout: 60000 // 60 segundos para descarga
    });
    
    const writer = fs.createWriteStream(filePath);
    
    // Pipe el stream de respuesta al archivo
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
  } catch (error) {
    console.error("Error descargando archivo:", error.message);
    throw error;
  }
}

function formatFileName(title) {
  return title
    .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
    .replace(/\s+/g, '_')     // Reemplazar espacios con guiones bajos
    .substring(0, 50) + '.mp3'; // Limitar longitud
}

// ===== MANEJADOR DEL COMANDO =====
module.exports = async (msg, { conn }) => {
  try {
    const prefix = process.env.PREFIX || '.';
    const text = msg.body?.trim() || '';
    
    // Extraer consulta (remover ".play ")
    const query = text.startsWith(`${prefix}play`) 
      ? text.slice(prefix.length + 5).trim()
      : text.startsWith('play ') 
        ? text.slice(5).trim()
        : '';
    
    if (!query) {
      return conn.sendMessage(msg.key.remoteJid, {
        text: `🎵 *Uso correcto:*\n${prefix}play <nombre de la canción o artista>\n\n*Ejemplo:*\n${prefix}play bad bunny`
      }, { quoted: msg });
    }
    
    // Indicador de procesamiento
    await conn.sendMessage(msg.key.remoteJid, {
      text: `🔍 Buscando: "${query}"...`
    }, { quoted: msg });
    
    // Buscar en YouTube
    const video = await searchYouTube(query);
    if (!video) {
      return conn.sendMessage(msg.key.remoteJid, {
        text: '❌ No encontré resultados para tu búsqueda.'
      }, { quoted: msg });
    }
    
    const { title, url: videoUrl, duration, thumbnail } = video;
    
    // Información del video encontrado
    await conn.sendMessage(msg.key.remoteJid, {
      text: `✅ *Encontrado:* ${title}\n⏱️ Duración: ${duration}\n\n⬇️ Descargando audio...`
    }, { quoted: msg });
    
    // Intentar con tu API primero
    let audioDownloadUrl = null;
    
    // 1. Intentar con TU API (con API Key)
    audioDownloadUrl = await downloadAudioFromAPI(videoUrl, USER_API, 'Mikeywilker1');
    
    // 2. Si falla, intentar con APIs públicas de respaldo
    if (!audioDownloadUrl) {
      for (const backupApi of BACKUP_APIS) {
        audioDownloadUrl = await downloadAudioFromAPI(videoUrl, backupApi);
        if (audioDownloadUrl) break;
      }
    }
    
    // 3. Último recurso: usar API directa de ytmp3
    if (!audioDownloadUrl) {
      try {
        const fallbackResponse = await axios.get(`https://ytmp3.iam7.tk/api/v1/getAudio?url=${encodeURIComponent(videoUrl)}`, {
          timeout: 30000
        });
        if (fallbackResponse.data?.url) {
          audioDownloadUrl = fallbackResponse.data.url;
        }
      } catch (fallbackError) {
        console.error("Fallback también falló:", fallbackError.message);
      }
    }
    
    if (!audioDownloadUrl) {
      return conn.sendMessage(msg.key.remoteJid, {
        text: '❌ No pude obtener el enlace de descarga. Intenta con otra canción.'
      }, { quoted: msg });
    }
    
    // Crear carpeta temporal si no existe
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Descargar archivo
    const fileName = formatFileName(title);
    const filePath = path.join(tmpDir, `${Date.now()}_${fileName}`);
    
    await conn.sendMessage(msg.key.remoteJid, {
      text: '📥 Descargando archivo MP3...'
    });
    
    await downloadFile(audioDownloadUrl, filePath);
    
    // Verificar tamaño del archivo
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      fs.unlinkSync(filePath);
      return conn.sendMessage(msg.key.remoteJid, {
        text: `❌ El archivo es muy grande (${fileSizeMB.toFixed(2)}MB). Límite: ${MAX_FILE_SIZE_MB}MB.`
      });
    }
    
    // Enviar audio
    await conn.sendMessage(msg.key.remoteJid, {
      audio: fs.readFileSync(filePath),
      mimetype: 'audio/mpeg',
      fileName: fileName
    }, { quoted: msg });
    
    // Mensaje de confirmación
    await conn.sendMessage(msg.key.remoteJid, {
      text: `✅ *Listo!*\n🎵 ${title}\n💾 ${fileSizeMB.toFixed(2)}MB`
    });
    
    // Limpiar archivo temporal
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.error("Error limpiando archivo:", cleanupError.message);
    }
    
  } catch (error) {
    console.error("Error en comando play:", error);
    
    await conn.sendMessage(msg.key.remoteJid, {
      text: `❌ Ocurrió un error:\n${error.message}\n\nIntenta de nuevo o con otra canción.`
    }, { quoted: msg });
  }
};

// Configuración del comando
module.exports.command = ['play', 'p', 'musica', 'music'];
module.exports.help = [
  '🎵 *Comando PLAY*',
  '',
  'Descarga audio de YouTube automáticamente.',
  '',
  '*Uso:*',
  '.play <nombre de la canción>',
  '.play <nombre del artista>',
  '',
  '*Ejemplos:*',
  '.play bad bunny',
  '.play shape of you',
  '.play música para estudiar'
].join('\n');