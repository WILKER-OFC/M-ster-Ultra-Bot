const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const handler = async (msg, { conn, text }) => {
  try {
    const rawID = conn.user?.id || "";
    const subbotID = rawID.split(":")[0] + "@s.whatsapp.net";

    const chatJid = msg.key.remoteJid;
    const isGroup = chatJid.endsWith("@g.us");
    const senderJid = isGroup ? msg.key.participant : subbotID;
    const isFromSubbot = msg.key.fromMe === true && senderJid === subbotID;

    if (!isFromSubbot) {
      return await conn.sendMessage(chatJid, {
        text: "❌ Este comando solo puede ser usado por el *subbot desde su propio número* (grupo o privado).",
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
        text: `📌 *Uso correcto del comando:*\n\nResponde a un *video, GIF o imagen* con el comando:\n*setmenu NombreDelBot*\n\n📌 *Ejemplos:*\n> setmenu Azura Infinity\n> setmenu Mi Bot Personalizado\n\n📌 *Tipos soportados:*\n• Videos (MP4, MOV)\n• GIFs animados\n• Imágenes (JPG, PNG)`
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
        imagen: data[subbotID]?.imagen || null
      };
    } else if (mediaType === "video") {
      data[subbotID] = {
        nombre: text,
        video: base64,
        // Mantener imagen por compatibilidad si ya existía
        imagen: data[subbotID]?.imagen || null
      };
    } else {
      // Para imágenes (backward compatibility)
      data[subbotID] = {
        nombre: text,
        imagen: base64
      };
    }

    fs.writeFileSync(setMenuPath, JSON.stringify(data, null, 2));

    // Mensaje de confirmación según el tipo
    let confirmMessage = "";
    if (mediaType === "gif") {
      confirmMessage = `✅ Menú personalizado guardado como:\n*${text}*\n🎬 GIF animado aplicado correctamente.`;
    } else if (mediaType === "video") {
      confirmMessage = `✅ Menú personalizado guardado como:\n*${text}*\n🎥 Video aplicado correctamente.`;
    } else {
      confirmMessage = `✅ Menú personalizado guardado como:\n*${text}*\n📸 Imagen aplicada correctamente.`;
    }

    await conn.sendMessage(chatJid, {
      text: confirmMessage,
      quoted: msg
    });

    // Enviar vista previa del menú actualizado
    try {
      // Simular comando menu para mostrar vista previa
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
    } catch (previewError) {
      console.log("No se pudo mostrar vista previa:", previewError.message);
    }

    await conn.sendMessage(chatJid, {
      react: { text: "✅", key: msg.key }
    });

  } catch (e) {
    console.error("❌ Error en setmenu:", e);
    await conn.sendMessage(chatJid, {
      text: `❌ Ocurrió un error al guardar el menú personalizado.\n\nDetalle: ${e.message}`,
      quoted: msg
    });
  }
};

handler.command = ["setmenu"];
module.exports = handler;