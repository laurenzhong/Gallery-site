export type Photo = {
  id: string;
  src: string;
  title: string;
  slug?: string;
  category: string;
  filename: string;
  width: number;
  height: number;
  isHero?: boolean;
};

export const categories = [
  "山野",
  "建筑",
  "日出日落",
  "森林",
  "河流",
  "海洋",
  "石塘度假区",
  "花朵",
  "harbor"
] as const;

export const photos: Photo[] = [
  {
    "id": "photo-001",
    "src": "/photos/山野/DSC_0888.JPG",
    "title": "DSC_0888",
    "slug": "dsc-0888",
    "category": "山野",
    "filename": "DSC_0888.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-002",
    "src": "/photos/山野/DSC_1293.JPG",
    "title": "DSC_1293",
    "slug": "dsc-1293",
    "category": "山野",
    "filename": "DSC_1293.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-003",
    "src": "/photos/山野/DSC_1295.JPG",
    "title": "DSC_1295",
    "slug": "dsc-1295",
    "category": "山野",
    "filename": "DSC_1295.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-004",
    "src": "/photos/山野/DSC_1353.JPG",
    "title": "DSC_1353",
    "slug": "dsc-1353",
    "category": "山野",
    "filename": "DSC_1353.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-005",
    "src": "/photos/山野/DSC_1367.JPG",
    "title": "DSC_1367",
    "slug": "dsc-1367",
    "category": "山野",
    "filename": "DSC_1367.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-006",
    "src": "/photos/山野/DSC_1411.JPG",
    "title": "DSC_1411",
    "slug": "dsc-1411",
    "category": "山野",
    "filename": "DSC_1411.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-007",
    "src": "/photos/山野/DSC_2347.JPG",
    "title": "DSC_2347",
    "slug": "dsc-2347",
    "category": "山野",
    "filename": "DSC_2347.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-008",
    "src": "/photos/山野/DSC_4820.JPG",
    "title": "DSC_4820",
    "slug": "dsc-4820",
    "category": "山野",
    "filename": "DSC_4820.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-009",
    "src": "/photos/山野/DSC_4826.JPG",
    "title": "DSC_4826",
    "slug": "dsc-4826",
    "category": "山野",
    "filename": "DSC_4826.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-010",
    "src": "/photos/山野/DSC_4853.JPG",
    "title": "DSC_4853",
    "slug": "dsc-4853",
    "category": "山野",
    "filename": "DSC_4853.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-011",
    "src": "/photos/山野/DSC_4858.JPG",
    "title": "DSC_4858",
    "slug": "dsc-4858",
    "category": "山野",
    "filename": "DSC_4858.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-012",
    "src": "/photos/山野/DSC_5403_01.JPG",
    "title": "DSC_5403_01",
    "slug": "dsc-5403-01",
    "category": "山野",
    "filename": "DSC_5403_01.JPG",
    "width": 5723,
    "height": 3815,
    "isHero": false
  },
  {
    "id": "photo-013",
    "src": "/photos/山野/DSC_5404.JPG",
    "title": "DSC_5404",
    "slug": "dsc-5404",
    "category": "山野",
    "filename": "DSC_5404.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-014",
    "src": "/photos/建筑/DSC_2935.JPG",
    "title": "DSC_2935",
    "slug": "dsc-2935",
    "category": "建筑",
    "filename": "DSC_2935.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-015",
    "src": "/photos/建筑/DSC_4837.JPG",
    "title": "DSC_4837",
    "slug": "dsc-4837",
    "category": "建筑",
    "filename": "DSC_4837.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-016",
    "src": "/photos/日出日落/DSC_0713.JPG",
    "title": "DSC_0713",
    "slug": "dsc-0713",
    "category": "日出日落",
    "filename": "DSC_0713.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-017",
    "src": "/photos/日出日落/DSC_0735.JPG",
    "title": "DSC_0735",
    "slug": "dsc-0735",
    "category": "日出日落",
    "filename": "DSC_0735.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-018",
    "src": "/photos/日出日落/DSC_2087.JPG",
    "title": "DSC_2087",
    "slug": "dsc-2087",
    "category": "日出日落",
    "filename": "DSC_2087.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-019",
    "src": "/photos/日出日落/DSC_2107.JPG",
    "title": "DSC_2107",
    "slug": "dsc-2107",
    "category": "日出日落",
    "filename": "DSC_2107.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-020",
    "src": "/photos/日出日落/DSC_2210.JPG",
    "title": "DSC_2210",
    "slug": "dsc-2210",
    "category": "日出日落",
    "filename": "DSC_2210.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-021",
    "src": "/photos/日出日落/DSC_3559.JPG",
    "title": "DSC_3559",
    "slug": "dsc-3559",
    "category": "日出日落",
    "filename": "DSC_3559.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-022",
    "src": "/photos/日出日落/DSC_5499.JPG",
    "title": "DSC_5499",
    "slug": "dsc-5499",
    "category": "日出日落",
    "filename": "DSC_5499.JPG",
    "width": 5924,
    "height": 3950,
    "isHero": true
  },
  {
    "id": "photo-023",
    "src": "/photos/日出日落/DSC_5503.JPG",
    "title": "DSC_5503",
    "slug": "dsc-5503",
    "category": "日出日落",
    "filename": "DSC_5503.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-024",
    "src": "/photos/森林/DSC_2913.JPG",
    "title": "DSC_2913",
    "slug": "dsc-2913",
    "category": "森林",
    "filename": "DSC_2913.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-025",
    "src": "/photos/森林/DSC_2952.JPG",
    "title": "DSC_2952",
    "slug": "dsc-2952",
    "category": "森林",
    "filename": "DSC_2952.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-026",
    "src": "/photos/森林/DSC_3247.JPG",
    "title": "DSC_3247",
    "slug": "dsc-3247",
    "category": "森林",
    "filename": "DSC_3247.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-027",
    "src": "/photos/森林/DSC_3343.JPG",
    "title": "DSC_3343",
    "slug": "dsc-3343",
    "category": "森林",
    "filename": "DSC_3343.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-028",
    "src": "/photos/森林/DSC_4832.JPG",
    "title": "DSC_4832",
    "slug": "dsc-4832",
    "category": "森林",
    "filename": "DSC_4832.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-029",
    "src": "/photos/河流/DSC_4840.JPG",
    "title": "DSC_4840",
    "slug": "dsc-4840",
    "category": "河流",
    "filename": "DSC_4840.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-030",
    "src": "/photos/河流/DSC_4844.JPG",
    "title": "DSC_4844",
    "slug": "dsc-4844",
    "category": "河流",
    "filename": "DSC_4844.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-031",
    "src": "/photos/海洋/DSC_2100.JPG",
    "title": "DSC_2100",
    "slug": "dsc-2100",
    "category": "海洋",
    "filename": "DSC_2100.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-032",
    "src": "/photos/海洋/DSC_5552.JPG",
    "title": "DSC_5552",
    "slug": "dsc-5552",
    "category": "海洋",
    "filename": "DSC_5552.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-033",
    "src": "/photos/石塘度假区/DSC_0243.JPG",
    "title": "DSC_0243",
    "slug": "dsc-0243",
    "category": "石塘度假区",
    "filename": "DSC_0243.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-034",
    "src": "/photos/石塘度假区/DSC_0257.JPG",
    "title": "DSC_0257",
    "slug": "dsc-0257",
    "category": "石塘度假区",
    "filename": "DSC_0257.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-035",
    "src": "/photos/石塘度假区/DSC_0264.JPG",
    "title": "DSC_0264",
    "slug": "dsc-0264",
    "category": "石塘度假区",
    "filename": "DSC_0264.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-036",
    "src": "/photos/石塘度假区/DSC_0335.JPG",
    "title": "DSC_0335",
    "slug": "dsc-0335",
    "category": "石塘度假区",
    "filename": "DSC_0335.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-037",
    "src": "/photos/石塘度假区/DSC_0396.JPG",
    "title": "DSC_0396",
    "slug": "dsc-0396",
    "category": "石塘度假区",
    "filename": "DSC_0396.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-038",
    "src": "/photos/石塘度假区/DSC_0470.JPG",
    "title": "DSC_0470",
    "slug": "dsc-0470",
    "category": "石塘度假区",
    "filename": "DSC_0470.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-039",
    "src": "/photos/石塘度假区/DSC_0513.JPG",
    "title": "DSC_0513",
    "slug": "dsc-0513",
    "category": "石塘度假区",
    "filename": "DSC_0513.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-040",
    "src": "/photos/石塘度假区/DSC_0514.JPG",
    "title": "DSC_0514",
    "slug": "dsc-0514",
    "category": "石塘度假区",
    "filename": "DSC_0514.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-041",
    "src": "/photos/石塘度假区/DSC_0518.JPG",
    "title": "DSC_0518",
    "slug": "dsc-0518",
    "category": "石塘度假区",
    "filename": "DSC_0518.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-042",
    "src": "/photos/石塘度假区/DSC_0520.JPG",
    "title": "DSC_0520",
    "slug": "dsc-0520",
    "category": "石塘度假区",
    "filename": "DSC_0520.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-043",
    "src": "/photos/石塘度假区/DSC_0521.JPG",
    "title": "DSC_0521",
    "slug": "dsc-0521",
    "category": "石塘度假区",
    "filename": "DSC_0521.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-044",
    "src": "/photos/石塘度假区/DSC_0522.JPG",
    "title": "DSC_0522",
    "slug": "dsc-0522",
    "category": "石塘度假区",
    "filename": "DSC_0522.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-045",
    "src": "/photos/石塘度假区/DSC_0534.JPG",
    "title": "DSC_0534",
    "slug": "dsc-0534",
    "category": "石塘度假区",
    "filename": "DSC_0534.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-046",
    "src": "/photos/石塘度假区/DSC_0538.JPG",
    "title": "DSC_0538",
    "slug": "dsc-0538",
    "category": "石塘度假区",
    "filename": "DSC_0538.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-047",
    "src": "/photos/石塘度假区/DSC_0546.JPG",
    "title": "DSC_0546",
    "slug": "dsc-0546",
    "category": "石塘度假区",
    "filename": "DSC_0546.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-048",
    "src": "/photos/石塘度假区/DSC_0551.JPG",
    "title": "DSC_0551",
    "slug": "dsc-0551",
    "category": "石塘度假区",
    "filename": "DSC_0551.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-049",
    "src": "/photos/石塘度假区/DSC_0552.JPG",
    "title": "DSC_0552",
    "slug": "dsc-0552",
    "category": "石塘度假区",
    "filename": "DSC_0552.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-050",
    "src": "/photos/石塘度假区/DSC_0555.JPG",
    "title": "DSC_0555",
    "slug": "dsc-0555",
    "category": "石塘度假区",
    "filename": "DSC_0555.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-051",
    "src": "/photos/石塘度假区/DSC_0566.JPG",
    "title": "DSC_0566",
    "slug": "dsc-0566",
    "category": "石塘度假区",
    "filename": "DSC_0566.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-052",
    "src": "/photos/石塘度假区/DSC_0568.JPG",
    "title": "DSC_0568",
    "slug": "dsc-0568",
    "category": "石塘度假区",
    "filename": "DSC_0568.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-053",
    "src": "/photos/石塘度假区/DSC_0571.JPG",
    "title": "DSC_0571",
    "slug": "dsc-0571",
    "category": "石塘度假区",
    "filename": "DSC_0571.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-054",
    "src": "/photos/石塘度假区/DSC_0580.JPG",
    "title": "DSC_0580",
    "slug": "dsc-0580",
    "category": "石塘度假区",
    "filename": "DSC_0580.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-055",
    "src": "/photos/石塘度假区/DSC_0613.JPG",
    "title": "DSC_0613",
    "slug": "dsc-0613",
    "category": "石塘度假区",
    "filename": "DSC_0613.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-056",
    "src": "/photos/石塘度假区/DSC_0614.JPG",
    "title": "DSC_0614",
    "slug": "dsc-0614",
    "category": "石塘度假区",
    "filename": "DSC_0614.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-057",
    "src": "/photos/石塘度假区/DSC_0625.JPG",
    "title": "DSC_0625",
    "slug": "dsc-0625",
    "category": "石塘度假区",
    "filename": "DSC_0625.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-058",
    "src": "/photos/石塘度假区/DSC_0626.JPG",
    "title": "DSC_0626",
    "slug": "dsc-0626",
    "category": "石塘度假区",
    "filename": "DSC_0626.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-059",
    "src": "/photos/石塘度假区/DSC_0632.JPG",
    "title": "DSC_0632",
    "slug": "dsc-0632",
    "category": "石塘度假区",
    "filename": "DSC_0632.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-060",
    "src": "/photos/石塘度假区/DSC_0636.JPG",
    "title": "DSC_0636",
    "slug": "dsc-0636",
    "category": "石塘度假区",
    "filename": "DSC_0636.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-061",
    "src": "/photos/石塘度假区/DSC_0638.JPG",
    "title": "DSC_0638",
    "slug": "dsc-0638",
    "category": "石塘度假区",
    "filename": "DSC_0638.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-062",
    "src": "/photos/石塘度假区/DSC_0648.JPG",
    "title": "DSC_0648",
    "slug": "dsc-0648",
    "category": "石塘度假区",
    "filename": "DSC_0648.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-063",
    "src": "/photos/石塘度假区/DSC_0917.JPG",
    "title": "DSC_0917",
    "slug": "dsc-0917",
    "category": "石塘度假区",
    "filename": "DSC_0917.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-064",
    "src": "/photos/石塘度假区/DSC_2196.JPG",
    "title": "DSC_2196",
    "slug": "dsc-2196",
    "category": "石塘度假区",
    "filename": "DSC_2196.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-065",
    "src": "/photos/花朵/DSC_5267.JPG",
    "title": "DSC_5267",
    "slug": "dsc-5267",
    "category": "花朵",
    "filename": "DSC_5267.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-066",
    "src": "/photos/花朵/DSC_5282.JPG",
    "title": "DSC_5282",
    "slug": "dsc-5282",
    "category": "花朵",
    "filename": "DSC_5282.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-067",
    "src": "/photos/花朵/DSC_5287.JPG",
    "title": "DSC_5287",
    "slug": "dsc-5287",
    "category": "花朵",
    "filename": "DSC_5287.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-068",
    "src": "/photos/花朵/DSC_5311.JPG",
    "title": "DSC_5311",
    "slug": "dsc-5311",
    "category": "花朵",
    "filename": "DSC_5311.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-069",
    "src": "/photos/花朵/DSC_5336.JPG",
    "title": "DSC_5336",
    "slug": "dsc-5336",
    "category": "花朵",
    "filename": "DSC_5336.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-070",
    "src": "/photos/花朵/DSC_5340.JPG",
    "title": "DSC_5340",
    "slug": "dsc-5340",
    "category": "花朵",
    "filename": "DSC_5340.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-071",
    "src": "/photos/花朵/DSC_5345.JPG",
    "title": "DSC_5345",
    "slug": "dsc-5345",
    "category": "花朵",
    "filename": "DSC_5345.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-072",
    "src": "/photos/花朵/DSC_5347.JPG",
    "title": "DSC_5347",
    "slug": "dsc-5347",
    "category": "花朵",
    "filename": "DSC_5347.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  },
  {
    "id": "photo-073",
    "src": "/photos/花朵/DSC_5445.JPG",
    "title": "DSC_5445",
    "slug": "dsc-5445",
    "category": "花朵",
    "filename": "DSC_5445.JPG",
    "width": 4032,
    "height": 6048,
    "isHero": false
  },
  {
    "id": "photo-074",
    "src": "/photos/harbor/DSC_5026.JPG",
    "title": "DSC_5026",
    "slug": "dsc-5026",
    "category": "harbor",
    "filename": "DSC_5026.JPG",
    "width": 6048,
    "height": 4032,
    "isHero": false
  }
];

export const initialHeroPhoto: Photo | undefined = {
  "id": "photo-dsc_5499-b50343c4",
  "src": "https://cdn.sanity.io/images/zj2ik922/production/31895c640a744fffaf18d9628d324ee2245ae5da-6048x4032.jpg?w=2560&q=90&auto=format&fit=max",
  "title": "DSC_5499",
  "slug": "dsc_5499-b50343",
  "category": "日出日落",
  "filename": "DSC_5499.JPG",
  "width": 6048,
  "height": 4032,
  "isHero": true
};
