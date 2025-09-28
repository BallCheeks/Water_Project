// Tp6EzxIVbiDmr80nzdV0
// src/main.js

import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

// 1) Grab your MapTiler key at https://www.maptiler.com/cloud/
// 2) Paste it here:
const STYLE_URL =
  'https://api.maptiler.com/maps/streets/style.json?key=Tp6EzxIVbiDmr80nzdV0';

const map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  center: [-118.25, 34.05],
  zoom: 8
});

map.on('load', () => {
  fetch('http://localhost:3000/api/points')
    .then((r) => r.json())
    .then(({ features }) => {
      // constants you can tweak
      const DROP_SIZE = 55;    // px
      const VIEWBOX   = 24;    // internal SVG units
      const FONT_UNITS= 6;     // font-size in those SVG units

      // pick fill-color
      const colorForValue = (v) => {
        if (v <= 30) return '#2ecc71';
        if (v <= 50) return '#f1c40f';
        if (v <= 70) return '#e67e22';
        return '#e74c3c';
      };

      features.forEach(({ geometry: { coordinates }, properties: { value } }) => {
        const fill = colorForValue(value);

        // build the SVG string
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg"
               viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"
               width="${DROP_SIZE}" height="${DROP_SIZE}">
            <path
              d="M12 2C8 8 6 12 6 16a6 6 0 0 0 12 0c0-4-2-8-6-14z"
              fill="${fill}"
              stroke="#ffffff"
              stroke-width="1"/>
            <text x="${VIEWBOX/2}" y="${VIEWBOX*0.65}"
                  font-size="${FONT_UNITS}"
                  font-family="Arial, sans-serif"
                  font-weight="bold"
                  text-anchor="middle"
                  fill="#000">
              ${value}
            </text>
          </svg>`.trim();

        // wrap it and size it
        const el = document.createElement('div');
        el.innerHTML = svg;
        el.style.width  = `${DROP_SIZE}px`;
        el.style.height = `${DROP_SIZE}px`;

        // center-anchor keeps the midpoint of your 55×55 box locked to the coord
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coordinates)
          .addTo(map);
      });
    })
    .catch((err) => console.error('Error loading points:', err));
});

