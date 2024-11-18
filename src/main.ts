// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
const app = document.querySelector<HTMLDivElement>("#app")!;
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;
const MOVE_STEP = TILE_DEGREES; // move 0.0001 degrees at a time
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

let serialCounter = 0;
const playerCoins: GeoCoin[] = [];

// key types
interface Cell {
  i: number;
  j: number;
}
interface LatLng {
  lat: number;
  lng: number;
}
interface GeoCoin {
  serial: number;
  i: number;
  j: number;
}
interface GeoRect {
  topL: LatLng;
  bottomR: LatLng;
}

// momento pattern for cache state
interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Cache implements Momento<string> {
  private coins: GeoCoin[];

  constructor(coins: GeoCoin[]) {
    this.coins = coins;
  }

  getCoins() {
    return this.coins;
  }

  setCoins(coins: GeoCoin[]) {
    this.coins = coins;
  }

  // implement momento method
  toMomento(): string {
    return JSON.stringify(this.coins); // serialize coins into a JSON string
  }

  fromMomento(momento: string): void {
    this.coins = JSON.parse(momento); // deserialize JSON string into coins
  }
}

const cacheStates = new Map<string, Cache>();

// map setup
const map = leaflet.map("map", {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: 14,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: true,
  scrollWheelZoom: false,
});
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// player marker
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.addTo(map);

// cache logic
const knownCells = new Map<string, Cell>();

function getCellForPoint(point: LatLng): Cell {
  return {
    i: Math.floor(point.lat / TILE_DEGREES),
    j: Math.floor(point.lng / TILE_DEGREES),
  };
}

function getRectForCell(cell: Cell): GeoRect {
  return {
    topL: { lat: cell.i * TILE_DEGREES, lng: cell.j * TILE_DEGREES },
    bottomR: {
      lat: (cell.i + 1) * TILE_DEGREES,
      lng: (cell.j + 1) * TILE_DEGREES,
    },
  };
}

// inventory UI
const inventoryHeader = document.createElement("h1");
app.append(inventoryHeader);

// creates coin count
const geonCoinText = document.createElement("div");
geonCoinText.id = "coinCountText";
app.appendChild(geonCoinText);

// inventory: coin count display
function updateInventory() {
  const coinCount = playerCoins.length; // counts total coins
  geonCoinText.innerHTML = `Coins: ${coinCount}`; // displays total coin count
}

// momento cache interaction
function handleCacheInteraction(cell: Cell, cacheCoins: GeoCoin[]) {
  const popupContent = document.createElement("div");
  const updatePopup = () => {
    popupContent.innerHTML = `
      <div>Cache at ${cell.i}, ${cell.j}: ${cacheCoins.length} coins</div>
      <button id="take">Take Coin</button>
      <button id="give">Give Coin</button>
    `;
  };
  updatePopup();

  popupContent.querySelector("#take")?.addEventListener("click", () => {
    if (cacheCoins.length > 0) {
      playerCoins.push(cacheCoins.pop()!);
      updateInventory();
      updatePopup();
    }
  });
  popupContent.querySelector("#give")?.addEventListener("click", () => {
    if (playerCoins.length > 0) {
      cacheCoins.push(playerCoins.pop()!);
      updateInventory();
      updatePopup();
    }
  });

  return popupContent;
}

// spawn cache
function spawnCache(cell: Cell) {
  if (knownCells.has(`${cell.i},${cell.j}`)) return;

  knownCells.set(`${cell.i},${cell.j}`, cell);
  const bounds = getRectForCell(cell);
  const cacheId = `${cell.i},${cell.j}`;

  // restore or create cache
  let cacheCoins: GeoCoin[] = [];
  if (cacheStates.has(cacheId)) {
    const cache = cacheStates.get(cacheId)!;
    cacheCoins = JSON.parse(cache.toMomento()); // deserialize coins from momento string
  } else {
    const coinCount = Math.round(100 * luck(`${cell.i},${cell.j}`)) + 1;
    cacheCoins = Array.from({ length: coinCount }, () => ({
      serial: serialCounter++,
      i: cell.i,
      j: cell.j,
    }));
    const newCache = new Cache(cacheCoins);
    cacheStates.set(cacheId, newCache); // save new cache
  }

  const rect = leaflet.rectangle([
    [bounds.topL.lat, bounds.topL.lng],
    [bounds.bottomR.lat, bounds.bottomR.lng],
  ]);
  rect.bindPopup(() => handleCacheInteraction(cell, cacheCoins));
  rect.addTo(map);
}

// generate caches
function generateCaches(center: Cell, radius: number) {
  for (let i = -radius; i <= radius; i++) {
    for (let j = -radius; j <= radius; j++) {
      if (luck(`${center.i + i},${center.j + j}`) < CACHE_SPAWN_PROBABILITY) {
        spawnCache({ i: center.i + i, j: center.j + j });
      }
    }
  }
}

// movement controls
function movePlayer(dLat: number, dLng: number) {
  const currentLatLng = playerMarker.getLatLng();
  const newLatLng = leaflet.latLng(
    currentLatLng.lat + dLat,
    currentLatLng.lng + dLng,
  );
  playerMarker.setLatLng(newLatLng);
  map.panTo(newLatLng);

  // regenerate caches
  generateCaches(getCellForPoint(newLatLng), NEIGHBORHOOD_SIZE);
}

// movement container
const movementControls = document.createElement("div");
movementControls.id = "movement-controls";

// movement buttons
const directions = [
  { id: "up", text: "⬆️", dLat: MOVE_STEP, dLng: 0 },
  { id: "left", text: "⬅️", dLat: 0, dLng: -MOVE_STEP },
  { id: "down", text: "⬇️", dLat: -MOVE_STEP, dLng: 0 },
  { id: "right", text: "➡️", dLat: 0, dLng: MOVE_STEP },
];

directions.forEach(({ id, text, dLat, dLng }) => {
  const button = document.createElement("button");
  button.id = id;
  button.innerText = text;
  button.addEventListener("click", () => movePlayer(dLat, dLng));
  movementControls.appendChild(button);
});

app.insertBefore(movementControls, inventoryHeader);

// initialize game
generateCaches(getCellForPoint(OAKES_CLASSROOM), NEIGHBORHOOD_SIZE);
updateInventory();
