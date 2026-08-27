import { load } from "./vendor/kanji2koe-openjtalk/index.js"

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

const API_SNIPPETS = {
  yukkuricode: `
import { Converter } from "zh-yukkuri"
const converter = new Converter(pinyin2KanaMap)
converter.koe(string)`.trim(),
  aqk2kcode: `
import { load } from "kanji2koe-openjtalk"
const k2k = await load()
k2k.convert(string)`.trim(),
  bakak2kcode: `
import { createDictAuto } from "bakak2k"
const bakak2k = await createDictAuto(dict)
bakak2k.toKana(string)`.trim(),
}

const $ = (id) => document.getElementById(id)

function bindConverters(converters) {
  for (const [id, fn] of Object.entries(converters)) {
    const input = $(id)
    const output = $(`${id}-output`)
    if (!input || !output) continue
    input.addEventListener("input", () => {
      const value = input.value
      if (!value) {
        output.textContent = "(输出会在这里展示)"
        output.classList.add("is-empty")
        return
      }
      try {
        output.textContent = fn(value) || "(空)"
        output.classList.remove("is-empty")
      } catch (err) {
        output.textContent = String(err)
        output.classList.remove("is-empty")
      }
    })
  }
}

async function withLoading(message, fn) {
  const loading = Qmsg.loading(message)
  try {
    return await fn()
  } finally {
    loading.close()
  }
}

;(async () => {
  const burger = document.querySelector("[data-burger]")
  const nav = document.querySelector("[data-nav]")
  if (burger && nav) {
    burger.addEventListener("click", () => nav.classList.toggle("is-open"))
  }

  for (const [id, text] of Object.entries(API_SNIPPETS)) {
    const el = $(id)
    if (el) el.textContent = text
  }

  const resources = await withLoading("正在加载资源", async () => {
    const mapText = await (await fetch("static/converter.tsv")).text()
    const blob = await (await fetch("static/small_dic.zip")).blob()
    return { map: mapText, aqdicURL: URL.createObjectURL(blob) }
  })
  Qmsg.success("资源加载成功")

  const { map, aqdicURL } = resources

  const bakaK2K = await withLoading("正在构建 BakaK2K 字典", async () => {
    const t = performance.now()
    const k = await yukkuri.createK2K(aqdicURL)
    Qmsg.success(`字典构建完成, 用时 ${Math.round(performance.now() - t)}ms`)
    return k
  }).catch((err) => {
    Qmsg.error(String(err))
    console.error(err)
    return null
  })

  const aqk2k = await withLoading("正在初始化 AqK2K-OpenJTalk", async () => {
    const t = performance.now()
    const k = await load()
    Qmsg.success(`初始化完成, 用时 ${Math.round(performance.now() - t)}ms`)
    return k
  }).catch((err) => {
    Qmsg.error(String(err))
    console.error(err)
    return null
  })

  const yukkuriWanakana = await yukkuri.load(undefined, undefined, { map })
  const yukkuriBakaK2K = bakaK2K
    ? await yukkuri.load(undefined, undefined, { map, k2k: bakaK2K })
    : yukkuriWanakana

  const converters = {
    koe: (s) => yukkuriWanakana.koe(s),
    cbakak2k: (s) => yukkuriBakaK2K.koe(s),
    bakak2k: bakaK2K ? (s) => bakaK2K.toKana(s) : () => "(BakaK2K 未加载)",
    aqk2k: aqk2k ? (s) => aqk2k.convert(s) : () => "(AqK2K 未加载)",
  }
  bindConverters(converters)
})().catch((err) => {
  console.error(err)
  Qmsg.error(String(err))
})
