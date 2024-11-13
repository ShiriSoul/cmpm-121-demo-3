// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
const app = document.querySelector<HTMLDivElement>("#app")!;

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

// gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8; // 8 cells distance out
const CACHE_SPAWN_PROBABILITY = 0.1; // cache spawn chance
let coinCount = 0;

// creates map
interface Cell {
  i: number;
  j: number;
}
const origin = {
  i: 0,
  j: 0,
};
const originLeaf = leaflet.latLng(origin.i, origin.j);
const playerMarker = leaflet.marker(originLeaf);
const map = leaflet.map(document.getElementById("map")!, {
  center: originLeaf,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});
// populates map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// text for geon coin amount
const geonCoinText = document.createElement("h1");
geonCoinText.innerHTML = "coin amount: " + coinCount;
app.append(geonCoinText);

// adds marker to location
playerMarker.addTo(map);
const knownCells = new Map<string, Cell>(); // track cells already processed

// Latitude/Longitude pairing
interface Latlng {
  lat: number;
  lng: number;
}

// drawing assist
interface GeoRect {
  topL: Latlng;
  bottomR: Latlng;
}

// update coin count
function updateCounter() {
  geonCoinText.innerHTML = "coin amount: " + coinCount;
}

function getRect(cell: Cell): GeoRect {
  return {
    topL: {
      lat: cell.i * TILE_DEGREES,
      lng: cell.j * TILE_DEGREES,
    },
    bottomR: {
      lat: (cell.i + 1) * TILE_DEGREES,
      lng: (cell.j + 1) * TILE_DEGREES,
    },
  };
}

function createCell(cell: Cell) {
  const bounds = getRect(cell);
  let coinAmount = Math.round(100 * luck([cell.i, cell.j].toString())) + 1; // determines coin amount

  const rect = leaflet.rectangle(
    [
      [bounds.topL.lat, bounds.topL.lng],
      [bounds.bottomR.lat, bounds.bottomR.lng],
    ],
    {
      color: "#FF0000", // red border color for cache
      weight: 1,
      fillColor: "#EFBF04", // gold fill color for cache
      fillOpacity: 0.5, // transparency
    },
  );
  rect.bindPopup(() => {
    const popUpBox = document.createElement("div");

    popUpBox.innerHTML = `
                <div>A cache here at "${cell.i},${cell.j}". There are <span id="value">${coinAmount}</span> coins here </div>
                <button id="get" style="background-color: green; color: white; border: none; padding: 10px 20px; margin: 5px; cursor: pointer;">take coin</button>
                <button id="give" style="background-color: blue; color: white; border: none; padding: 10px 20px; margin: 5px; cursor: pointer;">give coin</button>`;

    const getButton = popUpBox.querySelector<HTMLButtonElement>("#get")!;
    const giveButton = popUpBox.querySelector<HTMLButtonElement>("#give")!;

    // hover effects
    getButton.addEventListener("mouseover", () => {
      getButton.style.backgroundColor = "#45a049"; // color lightens on hover
    });
    getButton.addEventListener("mouseout", () => {
      getButton.style.backgroundColor = "green"; // reset to default color
    });

    giveButton.addEventListener("mouseover", () => {
      giveButton.style.backgroundColor = "#5c88d1"; // color lightens on hover
    });
    giveButton.addEventListener("mouseout", () => {
      giveButton.style.backgroundColor = "blue"; // reset to default color
    });

    // take button
    getButton.addEventListener("click", () => {
      if (coinAmount != 0) {
        coinAmount--;
        popUpBox.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          coinAmount.toString(); // Update the number of coins
        coinCount++;
        updateCounter();
      }
    });

    // give button
    giveButton.addEventListener("click", () => {
      if (coinCount != 0) {
        coinAmount++;
        popUpBox.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          coinAmount.toString();
        coinCount--;
        updateCounter();
      }
    });

    return popUpBox;
  });
  rect.addTo(map);
}

function determineSpawn(cell: Cell, chance: number) {
  const luckCheck = luck([cell.i, cell.j].toString());
  if (luckCheck <= chance) {
    createCell(cell);
  }
}

function locationCheck(min: number, max: number) {
  for (let x = min; x <= max; x++) {
    for (let y = min; y <= max; y++) {
      // only processes cells if it has not been processed yet
      const cellKey = `${x},${y}`;
      if (!knownCells.has(cellKey)) {
        const cell = { i: x, j: y };
        determineSpawn(cell, CACHE_SPAWN_PROBABILITY);
        knownCells.set(cellKey, cell); // marks cell as processed
      }
    }
  }
}

// generates caches around player location by calling locationCheck
locationCheck(-NEIGHBORHOOD_SIZE, NEIGHBORHOOD_SIZE);
locationCheck(-NEIGHBORHOOD_SIZE, NEIGHBORHOOD_SIZE);
