export type PhotoMeta = {
  date?: string;
  location?: string;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  focalLength?: string;
};

export type PhotoStory = {
  title: string;
  slug?: string;
  publishedAt?: string;
  orderRank?: string;
  isPinned?: boolean;
  pinOrder?: number;
  excerpt: string;
  body: string[];
};

export type AboutData = {
  name: string;
  location: string;
  bio: string[];
  gear: { name: string; value: string }[];
  contact: { label: string; value: string; href: string }[];
};

export const photoMeta: Record<string, PhotoMeta> = {
  "DSC_0257.JPG": {
    date: "2025-05-18",
    location: "浙江台州 · 石塘 · 珍珠滩",
    camera: "Sony A7M4",
    lens: "FE 24-70mm F2.8 GM II",
    aperture: "f/8",
    shutter: "1/250s",
    iso: 200,
    focalLength: "35mm",
  },
  "DSC_0243.JPG": {
    date: "2025-05-17",
    location: "浙江台州 · 石塘 · 滨海步道",
    camera: "Sony A7M4",
    lens: "FE 70-200mm F2.8 GM II",
    aperture: "f/4",
    shutter: "1/500s",
    iso: 400,
    focalLength: "135mm",
  },
  "DSC_1293.JPG": {
    date: "2024-09-22",
    location: "四川 · 四姑娘山 · 长坪沟",
    camera: "Sony A7M4",
    lens: "FE 16-35mm F2.8 GM",
    aperture: "f/11",
    shutter: "1/125s",
    iso: 100,
    focalLength: "24mm",
  },
  "DSC_2087.JPG": {
    date: "2024-08-15",
    location: "福建霞浦 · 北岐滩涂",
    camera: "Sony A7M4",
    lens: "FE 70-200mm F2.8 GM II",
    aperture: "f/11",
    shutter: "1/30s",
    iso: 100,
    focalLength: "120mm",
  },
  "DSC_2952.JPG": {
    date: "2024-06-10",
    location: "四川 · 毕棚沟",
    camera: "Sony A7M4",
    lens: "FE 24-70mm F2.8 GM II",
    aperture: "f/4",
    shutter: "1/60s",
    iso: 800,
    focalLength: "50mm",
  },
  "DSC_5267.JPG": {
    date: "2024-04-05",
    location: "上海 · 共青森林公园",
    camera: "Sony A7M4",
    lens: "FE 90mm F2.8 Macro G",
    aperture: "f/5.6",
    shutter: "1/200s",
    iso: 200,
    focalLength: "90mm",
  },
};

export const photoStories: Record<string, PhotoStory[]> = {
  "DSC_0257.JPG": [
    {
      title: "石塘清晨",
      excerpt: "五点半起床走到阳台外面的礁石上,海面被早晨的低光染成铅蓝色。",
      body: [
        "石塘的清晨通常没什么人。五点半起床,推开阳台门走到外面的礁石上,海面被早晨的低光染成铅蓝色,远处几艘渔船刚刚出港,马达声从海面传过来,被风切成一段一段。",
        "我蹲下来用礁石做前景,等了大概二十分钟才等到这一束光穿过云层的瞬间。云层很厚,光是一小块一小块漏下来的,落到海面上就亮一下,马上又被云盖住。",
        "这张是那二十分钟里最好的一帧。35mm 焦段刚好把船和礁石压到一个画面里,横构图保留了海平线的稳定感。后期只动了曲线和一点点去雾,没做其他调整——石塘的光本身已经足够干净。",
      ],
    },
  ],
  "DSC_1293.JPG": [
    {
      title: "四姑娘山长坪沟",
      excerpt: "从成都开了六小时车,海拔三千六百米,空气透明度极高。",
      body: [
        "从成都开了六小时车到四姑娘山脚下,最后一段盘山路没信号,只能靠离线地图。海拔三千六百米的位置,空气透明度极高,远处的雪峰像是被刀刻出来一样清晰,云几乎是静止的。",
        "用偏振镜压住天空的反差,让云彩的层次更明显。24mm 焦段保留了前景草甸的延伸感,雪山不会显得太突兀。",
        "回程路上才知道当天景区只有 100 个名额,我们赶上倒数第三组。",
      ],
    },
  ],
  "DSC_2952.JPG": [
    {
      title: "毕棚沟的森林光斑",
      excerpt: "原始森林里阳光透过树冠洒下来的瞬间,ISO 拉到了 800。",
      body: [
        "毕棚沟的森林比我想象中密。光透过树冠是一块一块漏下来的,落到苔藓上才看得清,其他地方都是暗的。",
        "ISO 拉到 800 才勉强拿到 1/60s 的快门,光圈已经开到 f/4 不能再大了。再慢手会抖,光斑的边缘也会因为长曝光糊掉。",
        "站在原地等了十几分钟,等一束光正好落在苔藓上才按下快门。这种光出现一次大概持续 5 秒,然后云过去就没了。",
      ],
    },
  ],
};

export const aboutData: AboutData = {
  name: "JiaKaiZhong",
  location: "浙江台州 / 上海",
  bio: [
    "在浙江长大,工作后搬到上海。喜欢清晨和傍晚的光,平时用一台 A7M4 记录身边能走到的地方。",
    "大部分照片是周末或者假期拍的,不刻意规划行程,更倾向于在熟悉的地方反复走。",
    "如果你想聊聊,可以通过邮件或者 Instagram 找到我。",
  ],
  gear: [
    { name: "机身", value: "Sony A7M4" },
    { name: "广角", value: "FE 16-35mm F2.8 GM" },
    { name: "标准", value: "FE 24-70mm F2.8 GM II" },
    { name: "长焦", value: "FE 70-200mm F2.8 GM II" },
    { name: "微距", value: "FE 90mm F2.8 Macro G" },
    { name: "滤镜", value: "NiSi True Color CPL · ND1000" },
    { name: "三脚架", value: "Peak Design Travel" },
  ],
  contact: [
    { label: "Email", value: "3552219514@qq.com", href: "mailto:3552219514@qq.com" },
    { label: "Instagram", value: "@gallery", href: "https://www.instagram.com/" },
    { label: "Youtube", value: "Channel", href: "https://www.youtube.com/" },
  ],
};
