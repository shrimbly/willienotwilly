export type FlagShape =
  | {
      kind: "rect";
      color: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: "circle";
      color: string;
      cx: number;
      cy: number;
      r: number;
    }
  | {
      kind: "polygon";
      color: string;
      points: string;
    };

export type BrandColorGameFlag = {
  id: string;
  name: string;
  targetHex: string;
  answerName: string;
  missingColor: string;
  difficulty: 1 | 2 | 3;
  shapes: readonly FlagShape[];
};

const WHITE = "#FFFFFF";
const BLANK = "#F8F6EE";

export const FLAG_BLANK_COLOR = BLANK;

export const BRAND_COLOR_GAME_FLAGS = [
  {
    id: "united-states",
    name: "United States",
    targetHex: "#3C3B6E",
    answerName: "United States flag blue",
    missingColor: "#3C3B6E",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: WHITE, x: 0, y: 0, width: 360, height: 240 },
      { kind: "rect", color: "#B22234", x: 0, y: 0, width: 360, height: 18.5 },
      { kind: "rect", color: "#B22234", x: 0, y: 37, width: 360, height: 18.5 },
      { kind: "rect", color: "#B22234", x: 0, y: 74, width: 360, height: 18.5 },
      { kind: "rect", color: "#B22234", x: 0, y: 111, width: 360, height: 18.5 },
      { kind: "rect", color: "#B22234", x: 0, y: 148, width: 360, height: 18.5 },
      { kind: "rect", color: "#B22234", x: 0, y: 185, width: 360, height: 18.5 },
      { kind: "rect", color: "#B22234", x: 0, y: 222, width: 360, height: 18 },
      { kind: "rect", color: "#3C3B6E", x: 0, y: 0, width: 144, height: 129.5 },
    ],
  },
  {
    id: "france",
    name: "France",
    targetHex: "#0055A4",
    answerName: "France flag blue",
    missingColor: "#0055A4",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#0055A4", x: 0, y: 0, width: 120, height: 240 },
      { kind: "rect", color: WHITE, x: 120, y: 0, width: 120, height: 240 },
      { kind: "rect", color: "#EF4135", x: 240, y: 0, width: 120, height: 240 },
    ],
  },
  {
    id: "germany",
    name: "Germany",
    targetHex: "#DD0000",
    answerName: "Germany flag red",
    missingColor: "#DD0000",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#000000", x: 0, y: 0, width: 360, height: 80 },
      { kind: "rect", color: "#DD0000", x: 0, y: 80, width: 360, height: 80 },
      { kind: "rect", color: "#FFCE00", x: 0, y: 160, width: 360, height: 80 },
    ],
  },
  {
    id: "italy",
    name: "Italy",
    targetHex: "#009246",
    answerName: "Italy flag green",
    missingColor: "#009246",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#009246", x: 0, y: 0, width: 120, height: 240 },
      { kind: "rect", color: WHITE, x: 120, y: 0, width: 120, height: 240 },
      { kind: "rect", color: "#CE2B37", x: 240, y: 0, width: 120, height: 240 },
    ],
  },
  {
    id: "japan",
    name: "Japan",
    targetHex: "#BC002D",
    answerName: "Japan flag red",
    missingColor: "#BC002D",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: WHITE, x: 0, y: 0, width: 360, height: 240 },
      { kind: "circle", color: "#BC002D", cx: 180, cy: 120, r: 56 },
    ],
  },
  {
    id: "canada",
    name: "Canada",
    targetHex: "#FF0000",
    answerName: "Canada flag red",
    missingColor: "#FF0000",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#FF0000", x: 0, y: 0, width: 90, height: 240 },
      { kind: "rect", color: WHITE, x: 90, y: 0, width: 180, height: 240 },
      { kind: "rect", color: "#FF0000", x: 270, y: 0, width: 90, height: 240 },
      { kind: "polygon", color: "#FF0000", points: "180,58 196,98 236,92 208,122 222,162 180,140 138,162 152,122 124,92 164,98" },
    ],
  },
  {
    id: "united-kingdom",
    name: "United Kingdom",
    targetHex: "#012169",
    answerName: "United Kingdom flag blue",
    missingColor: "#012169",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#012169", x: 0, y: 0, width: 360, height: 240 },
      { kind: "polygon", color: WHITE, points: "0,0 42,0 360,199 360,240 318,240 0,41" },
      { kind: "polygon", color: WHITE, points: "360,0 318,0 0,199 0,240 42,240 360,41" },
      { kind: "polygon", color: "#C8102E", points: "0,0 24,0 360,210 360,240 336,240 0,30" },
      { kind: "polygon", color: "#C8102E", points: "360,0 336,0 0,210 0,240 24,240 360,30" },
      { kind: "rect", color: WHITE, x: 150, y: 0, width: 60, height: 240 },
      { kind: "rect", color: WHITE, x: 0, y: 90, width: 360, height: 60 },
      { kind: "rect", color: "#C8102E", x: 164, y: 0, width: 32, height: 240 },
      { kind: "rect", color: "#C8102E", x: 0, y: 104, width: 360, height: 32 },
    ],
  },
  {
    id: "brazil",
    name: "Brazil",
    targetHex: "#009B3A",
    answerName: "Brazil flag green",
    missingColor: "#009B3A",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#009B3A", x: 0, y: 0, width: 360, height: 240 },
      { kind: "polygon", color: "#FFDF00", points: "180,34 326,120 180,206 34,120" },
      { kind: "circle", color: "#002776", cx: 180, cy: 120, r: 52 },
    ],
  },
  {
    id: "mexico",
    name: "Mexico",
    targetHex: "#006341",
    answerName: "Mexico flag green",
    missingColor: "#006341",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#006341", x: 0, y: 0, width: 120, height: 240 },
      { kind: "rect", color: WHITE, x: 120, y: 0, width: 120, height: 240 },
      { kind: "rect", color: "#CE1126", x: 240, y: 0, width: 120, height: 240 },
      { kind: "circle", color: "#9C6B30", cx: 180, cy: 120, r: 18 },
    ],
  },
  {
    id: "india",
    name: "India",
    targetHex: "#FF9933",
    answerName: "India flag saffron",
    missingColor: "#FF9933",
    difficulty: 1,
    shapes: [
      { kind: "rect", color: "#FF9933", x: 0, y: 0, width: 360, height: 80 },
      { kind: "rect", color: WHITE, x: 0, y: 80, width: 360, height: 80 },
      { kind: "rect", color: "#138808", x: 0, y: 160, width: 360, height: 80 },
      { kind: "circle", color: "#000080", cx: 180, cy: 120, r: 22 },
    ],
  },
  {
    id: "australia",
    name: "Australia",
    targetHex: "#00008B",
    answerName: "Australia flag blue",
    missingColor: "#00008B",
    difficulty: 2,
    shapes: [
      { kind: "rect", color: "#00008B", x: 0, y: 0, width: 360, height: 240 },
      { kind: "polygon", color: WHITE, points: "34,38 42,58 64,58 46,72 54,94 34,80 14,94 22,72 4,58 26,58" },
      { kind: "polygon", color: WHITE, points: "260,72 268,92 290,92 272,106 280,128 260,114 240,128 248,106 230,92 252,92" },
      { kind: "polygon", color: WHITE, points: "306,152 312,168 330,168 316,178 322,196 306,186 290,196 296,178 282,168 300,168" },
    ],
  },
  {
    id: "south-korea",
    name: "South Korea",
    targetHex: "#CD2E3A",
    answerName: "South Korea flag red",
    missingColor: "#CD2E3A",
    difficulty: 2,
    shapes: [
      { kind: "rect", color: WHITE, x: 0, y: 0, width: 360, height: 240 },
      { kind: "circle", color: "#CD2E3A", cx: 180, cy: 120, r: 38 },
      { kind: "circle", color: "#0047A0", cx: 180, cy: 132, r: 38 },
      { kind: "rect", color: "#000000", x: 74, y: 54, width: 54, height: 10 },
      { kind: "rect", color: "#000000", x: 232, y: 176, width: 54, height: 10 },
    ],
  },
  {
    id: "spain",
    name: "Spain",
    targetHex: "#AA151B",
    answerName: "Spain flag red",
    missingColor: "#AA151B",
    difficulty: 2,
    shapes: [
      { kind: "rect", color: "#AA151B", x: 0, y: 0, width: 360, height: 60 },
      { kind: "rect", color: "#F1BF00", x: 0, y: 60, width: 360, height: 120 },
      { kind: "rect", color: "#AA151B", x: 0, y: 180, width: 360, height: 60 },
    ],
  },
  {
    id: "sweden",
    name: "Sweden",
    targetHex: "#006AA7",
    answerName: "Sweden flag blue",
    missingColor: "#006AA7",
    difficulty: 2,
    shapes: [
      { kind: "rect", color: "#006AA7", x: 0, y: 0, width: 360, height: 240 },
      { kind: "rect", color: "#FECC00", x: 104, y: 0, width: 42, height: 240 },
      { kind: "rect", color: "#FECC00", x: 0, y: 99, width: 360, height: 42 },
    ],
  },
  {
    id: "south-africa",
    name: "South Africa",
    targetHex: "#007A4D",
    answerName: "South Africa flag green",
    missingColor: "#007A4D",
    difficulty: 2,
    shapes: [
      { kind: "rect", color: "#DE3831", x: 0, y: 0, width: 360, height: 120 },
      { kind: "rect", color: "#002395", x: 0, y: 120, width: 360, height: 120 },
      { kind: "polygon", color: WHITE, points: "0,0 150,120 0,240 0,198 98,120 0,42" },
      { kind: "polygon", color: "#007A4D", points: "0,18 128,120 0,222 0,176 72,120 0,64" },
      { kind: "polygon", color: "#FFB612", points: "0,46 62,120 0,194" },
      { kind: "polygon", color: "#000000", points: "0,66 42,120 0,174" },
    ],
  },
  {
    id: "china",
    name: "China",
    targetHex: "#DE2910",
    answerName: "China flag red",
    missingColor: "#DE2910",
    difficulty: 2,
    shapes: [
      { kind: "rect", color: "#DE2910", x: 0, y: 0, width: 360, height: 240 },
      { kind: "polygon", color: "#FFDE00", points: "72,38 82,64 110,64 88,80 96,108 72,92 48,108 56,80 34,64 62,64" },
      { kind: "circle", color: "#FFDE00", cx: 134, cy: 48, r: 8 },
      { kind: "circle", color: "#FFDE00", cx: 158, cy: 76, r: 8 },
      { kind: "circle", color: "#FFDE00", cx: 158, cy: 114, r: 8 },
      { kind: "circle", color: "#FFDE00", cx: 134, cy: 142, r: 8 },
    ],
  },
  {
    id: "argentina",
    name: "Argentina",
    targetHex: "#74ACDF",
    answerName: "Argentina flag blue",
    missingColor: "#74ACDF",
    difficulty: 3,
    shapes: [
      { kind: "rect", color: "#74ACDF", x: 0, y: 0, width: 360, height: 80 },
      { kind: "rect", color: WHITE, x: 0, y: 80, width: 360, height: 80 },
      { kind: "rect", color: "#74ACDF", x: 0, y: 160, width: 360, height: 80 },
      { kind: "circle", color: "#F6B40E", cx: 180, cy: 120, r: 20 },
    ],
  },
  {
    id: "norway",
    name: "Norway",
    targetHex: "#BA0C2F",
    answerName: "Norway flag red",
    missingColor: "#BA0C2F",
    difficulty: 3,
    shapes: [
      { kind: "rect", color: "#BA0C2F", x: 0, y: 0, width: 360, height: 240 },
      { kind: "rect", color: WHITE, x: 100, y: 0, width: 54, height: 240 },
      { kind: "rect", color: WHITE, x: 0, y: 93, width: 360, height: 54 },
      { kind: "rect", color: "#00205B", x: 116, y: 0, width: 22, height: 240 },
      { kind: "rect", color: "#00205B", x: 0, y: 109, width: 360, height: 22 },
    ],
  },
  {
    id: "greece",
    name: "Greece",
    targetHex: "#0D5EAF",
    answerName: "Greece flag blue",
    missingColor: "#0D5EAF",
    difficulty: 3,
    shapes: [
      { kind: "rect", color: "#0D5EAF", x: 0, y: 0, width: 360, height: 240 },
      { kind: "rect", color: WHITE, x: 0, y: 26.5, width: 360, height: 26.5 },
      { kind: "rect", color: WHITE, x: 0, y: 79.5, width: 360, height: 26.5 },
      { kind: "rect", color: WHITE, x: 0, y: 132.5, width: 360, height: 26.5 },
      { kind: "rect", color: WHITE, x: 0, y: 185.5, width: 360, height: 26.5 },
      { kind: "rect", color: "#0D5EAF", x: 0, y: 0, width: 133, height: 133 },
      { kind: "rect", color: WHITE, x: 53, y: 0, width: 27, height: 133 },
      { kind: "rect", color: WHITE, x: 0, y: 53, width: 133, height: 27 },
    ],
  },
  {
    id: "jamaica",
    name: "Jamaica",
    targetHex: "#009B3A",
    answerName: "Jamaica flag green",
    missingColor: "#009B3A",
    difficulty: 3,
    shapes: [
      { kind: "rect", color: "#009B3A", x: 0, y: 0, width: 360, height: 240 },
      { kind: "polygon", color: "#FED100", points: "0,0 34,0 360,206 360,240 326,240 0,34" },
      { kind: "polygon", color: "#FED100", points: "360,0 326,0 0,206 0,240 34,240 360,34" },
      { kind: "polygon", color: "#000000", points: "52,0 180,86 308,0" },
      { kind: "polygon", color: "#000000", points: "52,240 180,154 308,240" },
    ],
  },
] as const satisfies readonly BrandColorGameFlag[];
