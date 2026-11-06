import { defineArrayMember, defineField, defineType } from "sanity";

const coordinateFields = [
  defineField({ name: "latitude", title: "纬度", type: "number", validation: (Rule) => Rule.required().min(-90).max(90) }),
  defineField({ name: "longitude", title: "经度", type: "number", validation: (Rule) => Rule.required().min(-180).max(180) }),
];

export const mapRouteType = defineType({
  name: "mapRoute",
  title: "地图路线",
  type: "document",
  fields: [
    defineField({ name: "title", title: "路线名称", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "URL 标识", type: "slug", options: { source: "title", maxLength: 96 }, validation: (Rule) => Rule.required() }),
    defineField({ name: "sourceRouteId", title: "原有路线 ID", type: "string", readOnly: true, hidden: true }),
    defineField({ name: "subtitle", title: "路线简介", type: "text", rows: 3 }),
    defineField({ name: "sourceLabel", title: "来源说明", type: "string", description: "例如：个人 GPX · 2026-11-06。" }),
    defineField({ name: "color", title: "路线颜色", type: "string", description: "可选，例如 #a1493e。留空时由地图自动分配。" }),
    defineField({ name: "isVisible", title: "显示在地图上", type: "boolean", initialValue: true }),
    defineField({
      name: "stats",
      title: "路线统计",
      type: "object",
      fields: [
        defineField({ name: "distance", title: "距离（km）", type: "string" }),
        defineField({ name: "duration", title: "用时", type: "string" }),
        defineField({ name: "ascent", title: "累计爬升（m）", type: "string" }),
      ],
    }),
    defineField({
      name: "trackFile",
      title: "GPX 文件",
      type: "file",
      options: { accept: ".gpx,application/gpx+xml,application/xml,text/xml" },
      description: "上传徒步设备导出的 GPX，地图会自动读取其中的轨迹点。",
    }),
    defineField({
      name: "trackPoints",
      title: "手动轨迹点（可选）",
      type: "array",
      of: [defineArrayMember({ type: "object", fields: [...coordinateFields, defineField({ name: "elevationM", title: "海拔（m）", type: "number" })] })],
      description: "没有 GPX 时可少量手动填写；同时上传 GPX 时优先使用 GPX。",
    }),
    defineField({
      name: "stops",
      title: "地图标注点",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({ name: "title", title: "标注名称", type: "string", validation: (Rule) => Rule.required() }),
            defineField({ name: "localTitle", title: "中文名称", type: "string" }),
            defineField({ name: "coordinate", title: "坐标", type: "object", fields: coordinateFields, validation: (Rule) => Rule.required() }),
            defineField({ name: "trackIndex", title: "轨迹点索引", type: "number", description: "可选；不填时按最近轨迹点计算。" }),
            defineField({ name: "distanceKm", title: "距起点（km）", type: "number" }),
            defineField({ name: "time", title: "时间", type: "string" }),
            defineField({ name: "elevationM", title: "海拔（m）", type: "number" }),
            defineField({ name: "note", title: "标注说明", type: "text", rows: 3 }),
            defineField({ name: "photos", title: "关联照片", type: "array", of: [defineArrayMember({ type: "reference", to: [{ type: "photo" }], options: { disableNew: true } })], options: { layout: "grid" }, description: "这些照片会定位到当前标注点，并以缩略图显示。" }),
          ],
          preview: {
            select: { title: "title", localTitle: "localTitle", photos: "photos" },
            prepare: ({ title, localTitle, photos }) => ({ title: localTitle ? `${title} / ${localTitle}` : title, subtitle: `${photos?.length ?? 0} 张照片` }),
          },
        }),
      ],
    }),
  ],
  orderings: [
    { title: "最近更新", name: "updatedDesc", by: [{ field: "_updatedAt", direction: "desc" }] },
    { title: "名称", name: "titleAsc", by: [{ field: "title", direction: "asc" }] },
  ],
  preview: {
    select: { title: "title", visible: "isVisible", stops: "stops", media: "trackFile" },
    prepare: ({ title, visible, stops, media }) => ({ title, subtitle: `${visible === false ? "已隐藏" : "地图显示"} · ${stops?.length ?? 0} 个标注点`, media }),
  },
});
