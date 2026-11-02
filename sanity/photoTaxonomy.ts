export const photoSubjectOptions = [
  { title: "风景", value: "landscape" },
  { title: "山体", value: "mountain" },
  { title: "花朵", value: "flower" },
  { title: "植物", value: "plant" },
  { title: "森林", value: "forest" },
  { title: "建筑", value: "architecture" },
  { title: "城市", value: "city" },
  { title: "河流", value: "river" },
  { title: "海洋", value: "ocean" },
  { title: "天空", value: "sky" },
  { title: "道路", value: "road" },
  { title: "人物", value: "person" },
  { title: "物件", value: "object" },
  { title: "抽象", value: "abstract" },
] as const;

export const photoConditionOptions = [
  { title: "日出", value: "sunrise" },
  { title: "日落", value: "sunset" },
  { title: "白天", value: "day" },
  { title: "夜晚", value: "night" },
  { title: "雾", value: "fog" },
  { title: "雨", value: "rain" },
  { title: "雪", value: "snow" },
  { title: "阴天", value: "overcast" },
] as const;

export type PhotoSubject = (typeof photoSubjectOptions)[number]["value"];
export type PhotoCondition = (typeof photoConditionOptions)[number]["value"];

export const photoSubjectLabel = Object.fromEntries(photoSubjectOptions.map((item) => [item.value, item.title]));
export const photoConditionLabel = Object.fromEntries(photoConditionOptions.map((item) => [item.value, item.title]));
