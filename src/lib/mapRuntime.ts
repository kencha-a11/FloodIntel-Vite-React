import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre derives its worker from import.meta.url, which points at the
// bundled chunk. Point it at the emitted asset instead.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

/*
 * The one MapLibre entry point for both lazy maps, so the worker URL is set in
 * one place. Both lazy chunks share this runtime, which vite.config.ts keeps
 * out of the precache and in the bounded `map-runtime` runtime cache.
 */
export { maplibregl, maplibreWorkerUrl }
