Qmsg.config({
  style: `
    .qmsg .qmsg-content {
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      color: #ededed;
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, .6);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 13px;
    }
    .qmsg .qmsg-icon-close { color: #8a8a8a; }
    .qmsg .qmsg-content-info svg path { fill: #8a8a8a; }
    .qmsg .qmsg-content-success svg path { fill: #86efac; }
    .qmsg .qmsg-content-warning svg path { fill: #fde047; }
    .qmsg .qmsg-content-error svg path { fill: #fb7185; }
    .qmsg .qmsg-content-loading svg path { fill: #d0d0d0; }
  `,
})

const RESOURCE_PATHS = [
  "static/converter.tsv",
  "static/voices/v86.wasm",
  "static/voices/f1.zip",
  "static/voices/f2.zip",
  "static/voices/imd1.zip",
  "static/voices/m1.zip",
  "static/voices/m2.zip",
  "static/voices/jgr.zip",
  "static/voices/dvd.zip",
  "static/voices/r1.zip",
]

const $ = (id) => document.getElementById(id)
const els = {
  input: $("input"),
  filename: $("filename"),
  voices: $("voices"),
  speed: $("speed"),
  speedNumber: $("speednumber"),
  play: $("play"),
  download: $("download"),
}

const useBeta = location.search.includes("beta=")
let k2k

async function maybeLoadBeta() {
  if (useBeta) {
    const loading = Qmsg.loading("正在加载 BakaK2K, 这可能需要一段时间")
    try {
      k2k = await yukkuri.createK2K("static/small_dic.zip")
      Qmsg.success("BakaK2K 加载完成!")
    } finally {
      loading.close()
    }
    return
  }
  if (localStorage.getItem("bts")) return

  const banner = document.getElementById("beta-banner")
  if (!banner) return
  banner.hidden = false
  banner.addEventListener("click", (e) => {
    const action = e.target.closest("[data-beta-action]")?.dataset.betaAction
    if (!action) return
    banner.hidden = true
    if (action === "enable") {
      location.href = ".?beta=1"
    } else {
      localStorage.setItem("bts", "1")
    }
  }, { once: true })
}

async function loadResources() {
  const loading = Qmsg.loading("资源加载中, 请稍等...")
  try {
    const list = Object.fromEntries(await yukkuri.Resource.loadList(RESOURCE_PATHS))
    const map = await (await fetch(list["static/converter.tsv"])).text()
    Qmsg.success("资源加载完成")
    return { list, map }
  } finally {
    loading.close()
  }
}

function makePlayer(map, list) {
  let instance = { destroy: () => {} }
  const cache = new Map()
  let ready

  const create = async (voice) => {
    instance = await yukkuri.load(
      list[`static/voices/${voice}.zip`],
      `${voice}/AquesTalk.dll`,
      { wasmPath: list["static/voices/v86.wasm"], map, k2k },
    )
  }

  const ensure = async () => {
    if (!ready) ready = create(els.voices.value).then(() => Qmsg.success("已就绪"))
    return ready
  }

  const speak = async () => {
    const text = els.input.value
    const speed = els.speed.value
    const key = `${els.voices.value}|${text}|${speed}`
    if (cache.has(key)) {
      cache.get(key).play()
      return
    }
    const wav = await instance.run(text, speed)
    const audio = new Audio(URL.createObjectURL(new Blob([wav], { type: "audio/wav" })))
    cache.set(key, audio)
    audio.play()
  }

  const download = async () => {
    Qmsg.info("下载未做缓存优化, 可能较慢")
    const wav = await instance.run(els.input.value, els.speed.value)
    const blob = new Blob([wav], { type: "audio/wav" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.download = els.filename.value
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }

  els.voices.addEventListener("change", () => {
    ready = create(els.voices.value).then(() => Qmsg.success("已切换语音"))
  })
  els.speed.addEventListener("input", () => {
    els.speedNumber.textContent = `${els.speed.value}%`
  })
  els.play.addEventListener("click", async () => {
    try {
      await ensure()
      await speak()
    } catch (err) {
      console.error(err)
      Qmsg.error(String(err))
    }
  })
  els.download.addEventListener("click", async () => {
    try {
      await ensure()
      await download()
    } catch (err) {
      console.error(err)
      Qmsg.error(String(err))
    }
  })

  return { ensure }
}

;(async () => {
  const burger = document.querySelector("[data-burger]")
  const nav = document.querySelector("[data-nav]")
  if (burger && nav) {
    burger.addEventListener("click", () => nav.classList.toggle("is-open"))
  }

  await maybeLoadBeta()

  const loading = Qmsg.loading("正在初始化合成器")
  const { list, map } = await loadResources()
  const player = makePlayer(map, list)
  await player.ensure()
  loading.close()
})().catch((err) => {
  console.error(err)
  Qmsg.error(String(err))
})
