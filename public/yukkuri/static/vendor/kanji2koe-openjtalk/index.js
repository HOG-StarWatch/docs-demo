import init, { Kanji2Koe as WasmKanji2Koe } from "../pkg/aqkanji2koe_wasm.js";
export class Kanji2Koe {
    #inner;
    constructor(inner) {
        this.#inner = inner;
    }
    convert(text) {
        return this.#inner.convert(text);
    }
    convertRoman(text) {
        return this.#inner.convertRoman(text);
    }
}
const DEFAULT_WASM_URL = new URL("../pkg/aqkanji2koe_wasm_bg.wasm", import.meta.url);
let initPromise;
export async function load(options = {}) {
    if (!initPromise) {
        initPromise = initWasm(options.wasmPath);
    }
    await initPromise;
    return new Kanji2Koe(new WasmKanji2Koe());
}
async function initWasm(wasmPath) {
    const source = wasmPath ?? DEFAULT_WASM_URL;
    if (isNodeLike()) {
        const bytes = await readNodeWasm(source);
        await init({ module_or_path: bytes });
        return;
    }
    await init({ module_or_path: source });
}
function isNodeLike() {
    return (typeof process !== "undefined" &&
        typeof process.versions === "object" &&
        typeof process.versions.node === "string");
}
async function readNodeWasm(source) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const filePath = source instanceof URL
        ? fileURLToPath(source)
        : source.startsWith("file://")
            ? fileURLToPath(source)
            : source;
    return readFile(filePath);
}
