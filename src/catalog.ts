export interface SkyMark {
  name: string;
  code: string;
  position: [number, number, number];
  note: string;
}

export interface Galaxy {
  id: string;
  number: string;
  name: string;
  en: string;
  catalog: string;
  type: string;
  morphology: string;
  intro: string;
  diameter: string;
  stars: string;
  distance: string;
  ra: string;
  dec: string;
  tilt: number;
  roll: number;
  note: string;
  marks: [SkyMark, SkyMark];
}

export const galaxies: Galaxy[] = [
  {
    id: "milky-way",
    number: "01",
    name: "银河系",
    en: "Milky Way",
    catalog: "MW",
    type: "棒旋星系",
    morphology: "SBbc",
    intro: "我们的宇宙家园。千亿颗恒星沿着旋臂，围绕明亮的银心缓缓运行。",
    diameter: "105,700",
    stars: "1,000–4,000 亿",
    distance: "太阳系所在星系",
    ra: "17h 45m 40s",
    dec: "−29° 00′ 28″",
    tilt: 1.115,
    roll: 0.32,
    note: "银河系是一座棒旋星系。它的中心是一条由恒星组成的棒状结构，两侧延伸出富含气体与星尘的旋臂。太阳系身处猎户臂，距离银心约 2.6 万光年。",
    marks: [
      {
        name: "银心",
        code: "GALACTIC CORE",
        position: [0, 0, 0.14],
        note: "穿过层层星尘，银河系中心藏着人马座 A*。这颗超大质量黑洞的质量约为太阳的四百万倍。",
      },
      {
        name: "太阳系",
        code: "SOLAR SYSTEM",
        position: [-2.66, -0.8, 0.09],
        note: "这是我们在银河系中的大致位置。太阳位于猎户臂，携带着地球和其他行星，约每 2.3 亿年绕银心一周。",
      },
    ],
  },
  {
    id: "andromeda",
    number: "02",
    name: "仙女座星系",
    en: "Andromeda",
    catalog: "M31",
    type: "旋涡星系",
    morphology: "SA(s)b",
    intro: "穿越两百多万光年的星光，来自本星系群中与银河系为邻的巨大星岛。",
    diameter: "152,000",
    stars: "约 1 万亿",
    distance: "约 254 万光年",
    ra: "00h 42m 44s",
    dec: "+41° 16′ 09″",
    tilt: 1.13,
    roll: 0.34,
    note: "仙女座星系是离银河系最近的大型旋涡星系，也是天文目录中的 M31。金黄色的核球以较老的恒星为主，外盘则点缀着年轻的蓝色星团。在无光污染的秋夜，它可以被肉眼看见。",
    marks: [
      {
        name: "星系核球",
        code: "CENTRAL BULGE",
        position: [0, 0, 0.16],
        note: "这片明亮的中央区域聚集着大量古老恒星，因此呈现温暖的金黄色。核心深处还藏着一颗超大质量黑洞。",
      },
      {
        name: "恒星形成环",
        code: "STELLAR RING",
        position: [-2.78, -1.15, 0.08],
        note: "环绕星盘的气体与星尘是恒星的摇篮。在距离星系中心约一万秒差距的环状区域，恒星形成活动尤为活跃。",
      },
    ],
  },
  {
    id: "whirlpool",
    number: "03",
    name: "涡状星系",
    en: "Whirlpool",
    catalog: "M51",
    type: "宏观旋涡星系",
    morphology: "SA(s)bc",
    intro: "两条清晰的旋臂在深空中舒展，与相邻的伴星系共同演绎一场引力之舞。",
    diameter: "76,000",
    stars: "约 1,000 亿",
    distance: "约 2,300 万光年",
    ra: "13h 29m 53s",
    dec: "+47° 11′ 43″",
    tilt: 0.7,
    roll: -0.2,
    note: "涡状星系位于猎犬座，编号 M51。它是宏观旋涡星系的典型例子：两条连贯的长旋臂被明亮的年轻恒星勾勒出来。较小的伴星系 NGC 5195 正与它发生引力相互作用。",
    marks: [
      {
        name: "星系核心",
        code: "GALACTIC CORE",
        position: [0, 0, 0.12],
        note: "在 M51 的中心，密集的恒星围绕着一个活跃的星系核。旋臂从中央区域延伸而出，呈现出经典的双臂结构。",
      },
      {
        name: "伴星系",
        code: "NGC 5195",
        position: [3.64, 3.41, 0.12],
        note: "NGC 5195 是 M51 的伴星系。两者之间的引力相互作用塑造了醒目的旋臂，也促进了星际气体中的恒星形成。",
      },
    ],
  },
];

export const imagePath = (g: Galaxy, preview = false) =>
  `/assets/${g.id}${preview ? "-view" : ""}.webp`;
export const catalogLabel = (g: Galaxy) => `GAL — 0${g.number}`;
