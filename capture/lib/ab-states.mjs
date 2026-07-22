// The manual A/B state list, shared by capture/ab-shots.mjs and capture/ab-sheet.mjs.
const click = (selector) => `document.querySelector(${JSON.stringify(selector)}).click()`;
const clickText = (selector, text) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})]` +
  `.find((node) => node.textContent.includes(${JSON.stringify(text)})).click()`;

export const STATES = [
  { label: "01-default", steps: [], settleMs: 2500 },
  { label: "02-mode-EUPHORIC", steps: [clickText(".mode-buttons button", "EUPHORIC")], settleMs: 2500 },
  { label: "03-macro-ACID", steps: [click('.color-buttons button[data-color="ACID"]')], settleMs: 2500 },
  { label: "04-swarm-BLOOM", steps: [clickText(".swarm-buttons button", "BLOOM")], settleMs: 4000 },
  { label: "05-species-RIBBON", steps: ["document.querySelectorAll('.fish-card')[5].click()"], settleMs: 2500 },
  { label: "06-scene-FREE_SWIM", steps: [clickText(".scene-buttons button", "FREE SWIM")], settleMs: 6000 },
  { label: "07-dive-MANDALA", steps: [click(".dive-button")], settleMs: 6000 },
  { label: "08-blackout", steps: [clickText(".safety-controls button", "BLACKOUT")], settleMs: 2000 },
  {
    label: "09-reset",
    steps: [
      clickText(".mode-buttons button", "EUPHORIC"),
      click('.color-buttons button[data-color="ACID"]'),
      clickText(".swarm-buttons button", "BLOOM"),
      clickText(".scene-buttons button", "FREE SWIM"),
      click(".dive-button"),
      "await new Promise((r) => setTimeout(r, 3000))",
      clickText(".safety-controls button", "RESET"),
    ],
    settleMs: 6000,
  },
];

