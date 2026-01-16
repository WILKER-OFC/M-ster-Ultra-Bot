const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const handler = async (msg, { conn, text }) => {
  try {
    const rawID = conn.user?.id || "";
    const subbotID = rawID.split(":")[0] + "@s.whatsapp.net";

    const chatJid = msg.key.remoteJid;
    const isGroup = chatJid.endsWith("@g.us");
    
    // Verificar si el mensaje viene del bot (subbot)
    const isFromSubbot = msg.key.fromMe === true;

    if (!isFromSubbot) {
      return await conn.sendMessage(chatJid, {
        text: "❌ Este comando solo puede ser usado por el *subbot* (desde su propio número).",
      }, { quoted: msg });
    }

    const setMenuPath = path.resolve("setmenu.json");
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    // Detectar si es video o imagen
    const videoMsg = quoted?.videoMessage;
    const imageMsg = quoted?.imageMessage;
    const isGif = quoted?.videoMessage?.gifPlayback;

    // Verificar que tenga archivo multimedia y texto
    if ((!videoMsg && !imageMsg) || !text) {
      return await conn.sendMessage(chatJid, {
        text: `📌 *Uso correcto del comando:*\n\nResponde a un *video, GIF o imagen* con el comando:\n*setmenu NombreDelBot*\n\n📌 *Ejemplos:*\n> setmenu Azura Infinity\n> setmenu Mi Bot Personalizado\n\n📌 *Tipos soportados:*\n• Videos (MP4, MOV)\n• GIFs animados\n• Imágenes (JPG, PNG)\n\n📌 *Nota:* Este comando solo funciona si lo envía el propio subbot.`
      }, { quoted: msg });
    }

    let base64;
    let mediaType;

    if (videoMsg) {
      // Descargar video
      const stream = await downloadContentFromMessage(videoMsg, "video");
      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      base64 = buffer.toString("base64");
      mediaType = isGif ? "gif" : "video";
      
      // Verificar tamaño del video (máximo 16MB para WhatsApp)
      if (buffer.length > 16 * 1024 * 1024) {
        return await conn.sendMessage(chatJid, {
          text: "❌ El video es demasiado grande. WhatsApp tiene un límite de 16MB para videos.\n\n💡 *Sugerencia:* Usa un video más corto o comprímelo.",
          quoted: msg
        });
      }
    } else if (imageMsg) {
      // Descargar imagen (mantener compatibilidad)
      const stream = await downloadContentFromMessage(imageMsg, "image");
      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      base64 = buffer.toString("base64");
      mediaType = "imagen";
    }

    let data = fs.existsSync(setMenuPath)
      ? JSON.parse(fs.readFileSync(setMenuPath, "utf8"))
      : {};

    // Guardar datos según el tipo de medio
    if (mediaType === "gif") {
      data[subbotID] = {
        nombre: text,
        gif: base64,
        // Mantener imagen por compatibilidad si ya existía
        imagen: data[subbotID]?.imagen || null,
        timestamp: Date.now()
      };
    } else if (mediaType === "video") {
      data[subbotID] = {
        nombre: text,
        video: base64,
        // Mantener imagen por compatibilidad si ya existía
        imagen: data[subbotID]?.imagen || null,
        timestamp: Date.now()
      };
    } else {
      // Para imágenes (backward compatibility)
      data[subbotID] = {
        nombre: text,
        imagen: base64,
        timestamp: Date.now()
      };
    }

    fs.writeFileSync(setMenuPath, JSON.stringify(data, null, 2));

    // Mensaje de confirmación según el tipo
    let confirmMessage = "";
    let emoji = "";
    
    if (mediaType === "gif") {
      confirmMessage = `✅ *Menú personalizado guardado*\n\n🏷️ *Nombre:* ${text}\n🎬 *Tipo:* GIF animado\n📁 *Guardado para:* ${subbotID}\n\nEl menú ahora mostrará un GIF animado.`;
      emoji = "🎬";
    } else if (mediaType === "video") {
      confirmMessage = `✅ *Menú personalizado guardado*\n\n🏷️ *Nombre:* ${text}\n🎥 *Tipo:* Video\n📁 *Guardado para:* ${subbotID}\n\nEl menú ahora mostrará un video.`;
      emoji = "🎥";
    } else {
      confirmMessage = `✅ *Menú personalizado guardado*\n\n🏷️ *Nombre:* ${text}\n📸 *Tipo:* Imagen\n📁 *Guardado para:* ${subbotID}\n\nEl menú ahora mostrará una imagen.`;
      emoji = "📸";
    }

    await conn.sendMessage(chatJid, {
      text: confirmMessage,
      quoted: msg
    });

    // Enviar vista previa del menú actualizado (solo en privado para evitar spam en grupos)
    try {
      // Solo mostrar vista previa si es chat privado
      if (!isGroup) {
        const menuModule = require("./menu.js");
        if (menuModule && typeof menuModule.handler === "function") {
          // Crear un mensaje simulado para el handler del menú
          const simulatedMsg = {
            ...msg,
            key: {
              ...msg.key,
              fromMe: true
            }
          };
          await menuModule.handler(simulatedMsg, { conn });
        }
      } else {
        // En grupos, solo mostrar un mensaje pequeño
        await conn.sendMessage(chatJid, {
          text: `👁️ *Vista previa:* Usa el comando *${text.includes(" ") ? text.split(" ")[0] : text}* o *menu* para ver tu menú personalizado.`,
          quoted: msg
        });
      }
    } catch (previewError) {
      console.log("No se pudo mostrar vista previa:", previewError.message);
      // Enviar mensaje alternativo
      await conn.sendMessage(chatJid, {
        text: `📋 *Personalización completada*\n\nUsa el comando *menu* para ver tu nuevo menú con:\n🏷️ Nombre: ${text}\n${emoji} Multimedia: ${mediaType === 'gif' ? 'GIF animado' : mediaType === 'video' ? 'Video' : 'Imagen'}`,
        quoted: msg
      });
    }

    await conn.sendMessage(chatJid, {
      react: { text: "✅", key: msg.key }
    });

  } catch (e) {
    console.error("❌ Error en setmenu:", e);
    await conn.sendMessage(msg.key.remoteJid, {
      text: `❌ Ocurrió un error al guardar el menú personalizado.\n\n🔧 *Error:* ${e.message}\n\n💡 *Posibles soluciones:*\n• Verifica que el archivo no sea muy grande\n• Asegúrate de responder a un video/imagen válido\n• Intenta con un archivo más pequeño`,
      quoted: msg
    });
  }
};

handler.command = ["setmenu"];
module.exports = handler;