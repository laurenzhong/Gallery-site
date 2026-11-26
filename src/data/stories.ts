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
  image?: { src: string; alt: string; width: number; height: number; caption?: string };
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
  name: "Ethan",
  location: "湖北 襄阳 / 浙江 台州",
  image: {
    src: "https://cdn.sanity.io/images/zj2ik922/production/0813188c3df9a170c80cf8acd6f19de54ebfeff5-1080x1620.webp?w=1600&q=85&auto=format&fit=max",
    alt: "JiaKaiZhong 站在浅海中的背影",
    width: 1080,
    height: 1620,
  },
  bio: [
    "我想用一个风景优美的地方给网站取名，于是选了 Queenstown。这个名字让我想到湖、山和开阔的天空，也很贴近我想在这里分享的风景。",
    "我拍过浙江温岭石塘的渔港、香港的维港和麦理浩径沿线的海岸，也拍过武汉的江滩和浙东冬天的山脊。大部分照片是周末或假期拍的，有时专程去走一段山路，有时就在附近带着相机转一圈。",
    "我偏爱清晨和傍晚的海边。退潮后，滩涂上露出弯弯的水道。天快黑时，港里的船已经暗下来了，云边还留着一点光。遇到这样的景色，我总想换个时间再去走一趟。",
  ],
  gear: [
    { name: "机身", value: "Nikon Z6III" },
    { name: "标准", value: "Z 24-120mm f/4 S" },
    { name: "滤镜", value: "NiSi True Color CPL · ND1000" },
    { name: "三脚架", value: "LEAPLIGHT" },
    { name: "闪光灯", value: "斯丹德 闪60（FK580）" },
  ],
  contact: [
    { label: "Instagram", value: "@Zhong_Official", href: "https://www.instagram.com/Zhong_Official" },
    { label: "Facebook", value: "@EthanZhong22", href: "https://www.facebook.com/EthanZhong22" },
    { label: "WhatsApp", value: "+852 98755134", href: "https://wa.me/85298755134" },
    { label: "Email", value: "Ethanzhong0411@Gmail.com", href: "mailto:Ethanzhong0411@Gmail.com" },
    { label: "QQ 邮箱", value: "3552219514@qq.com", href: "mailto:3552219514@qq.com" },
  ],
};
