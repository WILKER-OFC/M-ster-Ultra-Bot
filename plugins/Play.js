const { spawn } from 'child_process'
const fs from 'fs'
const fetch from 'node-fetch'

const yt = {
  static: Object.freeze({
    baseUrl: 'https://cnv.cx',
    headers: {
      'accept-encoding': 'gzip, deflate, br, zstd',
      'origin': 'https://frame.y2meta-uk.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'
    }
  }),
  log(m) { console.log(`[yt-skrep] ${m}`) },
  resolveConverterPayload(link, f = '128k') {
    const formatos = ['128k', '320k', '144p', '240p', '360p', '720p', '1080p']
    if (!formatos.includes(f)) throw Error(`Formato inválido. Formatos disponibles: ${formatos.join(', ')}`)
    const tipo = f.endsWith('k') ? 'mp3' : 'mp4'
    const audioBitrate = tipo === 'mp3' ? parseInt(f) + '' : '128'
    const videoQuality = tipo === 'mp4' ? parseInt(f) + '' : '720'
    return { link, format: tipo, audioBitrate, videoQuality, filenameStyle: 'pretty', vCodec: 'h264' }
  },
  sanitizeFileName(n) {
    const ext = n.match(/\.[^.]+$/)[0]
    const name = n.replace(new RegExp(`\\${ext}$`), '').replaceAll(/[^A-Za-z0-9]/g, '_').replace(/_+/g, '_').toLowerCase()
    return name + ext
  },
  async getBuffer(u) {
    const h = structuredClone(this.static.headers)
    h.referer = 'https://v6.www-y2mate.com/'
    h.range = 'bytes=0-'
    delete h.origin
    const r = await fetch(u, { headers: h })
    if (!r.ok) throw Error(`${r.status} ${r.statusText}`)
    const ab = await r.arrayBuffer()
    return Buffer.from(ab)
  },
  async getKey() {
    const r = await fetch(this.static.baseUrl + '/v2/sanity/key', { headers: this.static.headers })
    if (!r.ok) throw Error(`${r.status} ${r.statusText}`)
    return await r.json()
  },
  async convert(u, f) {
    const { key } = await this.getKey()
    const p = this.resolveConverterPayload(u, f)
    const h = { key, ...this.static.headers }
    const r = await fetch(this.static.baseUrl + '/v2/converter', { headers: h, method: 'post', body: new URLSearchParams(p) })
    if (!r.ok) throw Error(`${r.status} ${r.statusText}`)
    return await r.json()
  },
  async download(u, f) {
    const { url, filename } = await this.convert(u, f)
    const buffer = await this.getBuffer(url)
    return { fileName: this.sanitizeFileName(filename), buffer }
  }
}

// Convertir video a faststart
async function convertToFast(buffer) {
  const tempIn = './temp_in.mp4'
  const tempOut = './temp_out.mp4'
  fs.writeFileSync(tempIn, buffer)
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-i', tempIn, '-c', 'copy', '-movflags', 'faststart', tempOut])
    ff.on('close', code => code === 0 ? res() : rej(new Error('Error al convertir con ffmpeg')))
  })
  const newBuffer = fs.readFileSync(tempOut)
  fs.unlinkSync(tempIn)
  fs.unlinkSync(tempOut)
  return newBuffer
}

// Handler audio (ytmp3)
let handler = async (m, { conn, args, command }) => {
  if (!args[0]) return m.reply(`*\`🧇 ESCRIBE UN LINK DE YOUTUBE, PARA DARTE EL AUDIO\`*`)

  try {
    await m.react('🕓') // reacción mientras descarga
    const formato = args[1] || '128k'
    const { buffer, fileName } = await yt.download(args[0], formato)

    await conn.sendMessage(m.chat, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName
    }, { quoted: m })

    await m.react('✅️') // reacción al terminar
  } catch (e) {
    return m.reply(`❌ Ocurrió un error: ${e.message}`)
  }
}

// Handler video (ytmp4)
let handler2 = async (m, { conn, args, command }) => {
  if (!args[0]) return m.reply(`*Ejemplo:* .${command} https://youtu.be/JiEW1agPqNY`)

  try {
    await m.react('🕓') // reacción mientras descarga
    const formato = args[1] || '720p'
    let { buffer, fileName } = await yt.download(args[0], formato)
    buffer = await convertToFast(buffer)

    await conn.sendMessage(m.chat, {
      video: buffer,
      mimetype: 'video/mp4',
      fileName
    }, { quoted: m })

    await m.react('✅️') // reacción al terminar
  } catch (e) {
    return m.reply(`❌ Ocurrió un error: ${e.message}`)
  }
}

// Comandos
handler.help = ['ytmp3 <link>']
handler.tags = ['dl']
handler.command = ['ytmp3', 'yta', 'ytmp3vd']

handler2.help = ['ytmp4 <link>']
handler2.tags = ['dl']
handler2.command = ['ytmp4', 'ytv', 'ytvideovd']

export default handler
export { handler2 }