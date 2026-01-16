const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn }) => {
  try {
    const rawID = conn.user?.id || "";
    const subbotID = rawID.split(":")[0] + "@s.whatsapp.net";

    const prefixPath = path.resolve("prefixes.json");
    const menuConfigPath = path.resolve("setmenu.json");

    let prefixes = {};
    if (fs.existsSync(prefixPath)) {
      prefixes = JSON.parse(fs.readFileSync(prefixPath, "utf-8"));
    }

    const usedPrefix = prefixes[subbotID] || ".";

    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "📜", key: msg.key }
    });

    let customData = {};
    if (fs.existsSync(menuConfigPath)) {
      customData = JSON.parse(fs.readFileSync(menuConfigPath, "utf8"));
    }

    const personal = customData[subbotID];
    const videoBuffer = personal?.video ? Buffer.from(personal.video, "base64") : null;
    const gifBuffer = personal?.gif ? Buffer.from(personal.gif, "base64") : null;
    const imageBuffer = personal?.imagen ? Buffer.from(personal.imagen, "base64") : null;
    const nombreMenu = personal?.nombre || "Azura Ultra 2.0 Subbot";

    let caption = "";
    
    // URL del video por defecto que proporcionaste
    const defaultVideoUrl = "https://o.uguu.se/GQbaQVtx.mp4";

    if (personal) {
      // MENÚ PERSONALIZADO DISEÑO BONITO
      caption = `
╭─❍ 𓂃 𝑺𝒖𝒃𝒃𝒐𝒕 𝑷𝒆𝒓𝒔𝒐𝒏𝒂𝒍𝒊𝒛𝒂𝒅𝒐 ❍─╮
│   𝙈𝙚𝙣𝙪́: *${nombreMenu}*
╰────────────────────╯
— 🔹 Ya los subbots tienen RPG de personajes y mascotas y puedes  
— 🔹 subirlo de nivel. Para ver los comandos del RPG usa: 
✦ ${usedPrefix}menurpg  
— 🔹 Verás todo lo que necesitas saber.

┏━━🧠 𝗜𝗻𝘁𝗲𝗹𝗶𝗴𝗲𝗻𝗰𝗶𝗮
┃ ✦ ${usedPrefix}chatgpt
┃ ✦ ${usedPrefix}geminis
┗━━━━━━━━━━━━━

┏━━📥 𝗗𝗲𝘀𝗰𝗮𝗿𝗴𝗮𝘀
┃ ✦ ${usedPrefix}play / ${usedPrefix}playdoc
┃ ✦ ${usedPrefix}play2 / ${usedPrefix}play2doc
┃ ✦ ${usedPrefix}ytmp3 / ${usedPrefix}ytmp3doc
┃ ✦ ${usedPrefix}ytmp4 / ${usedPrefix}ytmp4doc
┃ ✦ ${usedPrefix}apk / ${usedPrefix}fb / ${usedPrefix}ig / ${usedPrefix}tt
┗━━━━━━━━━━━━━

┏━━🎭 𝗠𝘂𝗹𝘁𝗶𝗺𝗲𝗱𝗶𝗮
┃ ✦ ${usedPrefix}s / ${usedPrefix}ver / ${usedPrefix}hd
┃ ✦ ${usedPrefix}toimg / ${usedPrefix}toaudio / ${usedPrefix}tts
┃ ✦ ${usedPrefix}whatmusic / ${usedPrefix}perfil
┗━━━━━━━━━━━━━

┏━━👥 𝗚𝗿𝘂𝗽𝗼𝘀
┃ ✦ ${usedPrefix}abrirgrupo / ${usedPrefix}cerrargrupo
┃ ✦ ${usedPrefix}infogrupo / ${usedPrefix}kick
┃ ✦ ${usedPrefix}modoadmins on/off
┃ ✦ ${usedPrefix}antilink on/off
┃ ✦ ${usedPrefix}welcome on/off
┃ ✦ ${usedPrefix}tagall / ${usedPrefix}todos
┃ ✦ ${usedPrefix}damelink / ${usedPrefix}antidelete
┃ ✦ ${usedPrefix}addco (agrega comando a stickerz)
┃ ✦ ${usedPrefix}delco (elimina el comando)
┗━━━━━━━━━━━━━

┏━━🎮 𝗝𝘂𝗲𝗴𝗼𝘀
┃ ✦ ${usedPrefix}kiss / ${usedPrefix}slap
┃ ✦ ${usedPrefix}topkiss / ${usedPrefix}topslap
┃ ✦ ${usedPrefix}verdad / ${usedPrefix}reto
┃ ✦ ${usedPrefix}mixemoji / ${usedPrefix}aniemoji
┗━━━━━━━━━━━━━

┏━━⚙️ 𝗖𝗼𝗻𝗳𝗶𝗴𝘀 & 𝗗𝘂𝗲ñ𝗼
┃ ✦ ${usedPrefix}setprefix / ${usedPrefix}ping
┃ ✦ ${usedPrefix}creador / ${usedPrefix}get
┃ ✦ ${usedPrefix}addlista / ${usedPrefix}dellista
┃ ✦ ${usedPrefix}addgrupo / ${usedPrefix}delgrupo
┃ ✦ ${usedPrefix}setmenu
┃ ✦ ${usedPrefix}delmenu
┗━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━
📍 TikTok: https://www.tiktok.com/@azuritabot?_t=ZT-8xpG3PgDQeT&_r=1
🎨 𝗠𝗲𝗻𝘂́ 𝗽𝗲𝗿𝘀𝗼𝗻𝗮𝗹𝗶𝘇𝗮𝗱𝗼 𝗽𝗼𝗿 𝗲𝗹 𝘂𝘀𝘂𝗮𝗿𝗶𝗼
`.trim();
    } else {
      // MENÚ POR DEFECTO NORMALITO
      caption = `
╔⌬ 
 *M-STER ULTRA SUBBOT*   
╚═──────────────────
┏━━━━━━━━━━━
┃usa: ${usedPrefix}menu 
┃y verás todo lo que ocupas saber.
┗━━━━━━━━━━━━

┏━━━━━━━━━━━━
┃👇Haz Que Tus Amigos Sean *SUBBOTS*     También Diles Que Envíen Estos Comando👇
┃
┃${usedPrefix}serbot / qr
┃${usedPrefix}code / codigo 
┃${usedPrefix}sercode / codigo
┗━━━━━━━━━━━


┏━━━━
┃〔 AI & Respuestas 〕
┃
┃${usedPrefix}chatgpt
┃${usedPrefix}geminis
┗━━━━━━━━━━━━

┏━━━━━━━━━━━━
┃ 〔 Descargas 〕
┃
┃${usedPrefix}play / ${usedPrefix}playdoc
┃${usedPrefix}play2 / ${usedPrefix}play2doc
┃${usedPrefix}play5
┃${usedPrefix}play6
┃${usedPrefix}ytmp3 / ${usedPrefix}ytmp3doc
┃${usedPrefix}ytmp35
┃${usedPrefix}ytmp4 / ${usedPrefix}ytmp4doc
┃${usedPrefix}ytmp45
┃${usedPrefix}apk
┃${usedPrefix}instagram / ${usedPrefix}ig
┃${usedPrefix}tiktok / ${usedPrefix}tt
┃${usedPrefix}facebook / ${usedPrefix}fb
┗━━━━━━━━━━━━━

┏━━━━━━━━━━━
┃〔 Stickers & Multimedia 〕
┃
┃${usedPrefix}s
┃${usedPrefix}ver
┃${usedPrefix}toaudio 
┃${usedPrefix}hd
┃${usedPrefix}toimg
┃${usedPrefix}whatmusic
┃${usedPrefix}tts
┃${usedPrefix}perfil
┗━━━━━━━━━━━━━━━━━━

┏━━━━━━━━━━━
┃〔 Grupos 〕
┃
┃${usedPrefix}abrirgrupo
┃${usedPrefix}cerrargrupo
┃${usedPrefix}infogrupo
┃${usedPrefix}kick
┃${usedPrefix}modoadmins on o off
┃${usedPrefix}antilink on o off
┃${usedPrefix}welcome on o off
┃${usedPrefix}tag
┃${usedPrefix}tagall / ${usedPrefix}invocar / ${usedPrefix}todos
┃${usedPrefix}infogrupo
┃${usedPrefix}damelink
┃${usedPrefix}antidelete on o off
┃${usedPrefix}addco (agrega comando al stickerz)
┃${usedPrefix}delco (elimina comando)
┃${usedPrefix}delete
┗━━━━━━━━━━━━━━━

┏━━━━━━━━━━
┃〔 Comandos De Juegos 〕
┃${usedPrefix}verdad
┃${usedPrefix}reto
┃${usedPrefix}memes o meme
┃${usedPrefix}kiss
┃${usedPrefix}topkiss
┃${usedPrefix}slap
┃${usedPrefix}topslap
┃${usedPrefix}mixemoji
┃${usedPrefix}aniemoji
┗━━━━━━━━━━━━━━

┏━━━━━━━━━━━
┃〔 Configuración & Dueño 〕
┃
┃${usedPrefix}antideletepri on o off
┃${usedPrefix}setprefix ↷ Cambiar prefijo del subbot
┃${usedPrefix}creador ↷ Contacto del creador
┃${usedPrefix}get ↷ Descargar estados
┃${usedPrefix}addgrupo ↷ Autorizar grupo para que lo usen
┃${usedPrefix}addlista ↷ Autorizar usuario privado para que lo use
┃${usedPrefix}dellista ↷ Quitar usuarios autorizados
┃${usedPrefix}delgrupo ↷ Eliminar grupo autorizado
┃${usedPrefix}ping ↷ Medir latencia del bot
┃${usedPrefix}setmenu ↷ Personaliza tu subbot
┃${usedPrefix}delmenu ↷ Quita lo personalizado
┗━━━━━━━━━━━━━

📱 Grupo oficial de 𝙈-𝙎𝙩𝙚𝙧-𝘽𝙤𝙩 🔹
🔗 https://chat.whatsapp.com/IN2dNxVceScLqXQCGEq5dY

═⌬ M-STER ULTRA BOT Subbot ⌬═`.trim();
    }

    // Lógica para enviar el contenido multimedia según lo configurado
    if (videoBuffer) {
      // Enviar video personalizado
      await conn.sendMessage(
        msg.key.remoteJid,
        {
          video: videoBuffer,
          caption: caption,
          gifPlayback: false
        },
        { quoted: msg }
      );
    } else if (gifBuffer) {
      // Enviar GIF personalizado
      await conn.sendMessage(
        msg.key.remoteJid,
        {
          video: gifBuffer,
          caption: caption,
          gifPlayback: true
        },
        { quoted: msg }
      );
    } else if (imageBuffer) {
      // Enviar imagen personalizada (compatibilidad con versiones anteriores)
      await conn.sendMessage(
        msg.key.remoteJid,
        {
          image: imageBuffer,
          caption: caption
        },
        { quoted: msg }
      );
    } else {
      // Enviar video por defecto desde la URL que proporcionaste
      await conn.sendMessage(
        msg.key.remoteJid,
        {
          video: { url: defaultVideoUrl },
          caption: caption,
          gifPlayback: false
        },
        { quoted: msg }
      );
    }

    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en el menú:", err);
    await conn.sendMessage(msg.key.remoteJid, {
      text: "❌ Ocurrió un error mostrando el menú.",
      quoted: msg
    });
  }
};

handler.command = ['menu', 'help', 'ayuda', 'comandos'];
module.exports = handler;