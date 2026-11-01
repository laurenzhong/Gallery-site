import { defineArrayMember, defineField, defineType } from "sanity";

const photoReference = defineArrayMember({
  type: "reference",
  to: [{ type: "photo" }],
  options: { disableNew: true },
});

const sectionStyles = [
  { title: "Hero 主视觉", value: "hero" },
  { title: "Feature Cards 特色卡片", value: "featureCards" },
  { title: "Landscape Carousel 横向轮播", value: "landscapeCarousel" },
  { title: "Banner 横幅", value: "banner" },
  { title: "Grid 方格", value: "grid" },
  { title: "Stack 堆叠", value: "stack" },
  { title: "Split 图文并排", value: "split" },
  { title: "Carousel 单图轮播", value: "carousel" },
];

const sectionFields = [
  defineField({
    name: "title",
    title: "标题",
    type: "string",
  }),
  defineField({
    name: "eyebrow",
    title: "眉题",
    type: "string",
  }),
  defineField({
    name: "description",
    title: "说明",
    type: "text",
    rows: 3,
  }),
  defineField({
    name: "isVisible",
    title: "显示此模块",
    type: "boolean",
    initialValue: true,
  }),
  defineField({
    name: "style",
    title: "显示样式",
    type: "string",
    options: { list: sectionStyles, layout: "dropdown" },
    initialValue: "landscapeCarousel",
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: "photos",
    title: "模块图片",
    type: "array",
    of: [photoReference],
    description: "手动选择图片；如果填写分类来源，则优先使用分类筛选结果。",
  }),
  defineField({
    name: "coverPhoto",
    title: "封面图片",
    type: "reference",
    to: [{ type: "photo" }],
    options: { disableNew: true },
    description: "Hero、Banner、Split 等单图样式使用。",
  }),
  defineField({
    name: "category",
    title: "分类来源",
    type: "reference",
    to: [{ type: "category" }],
    options: { disableNew: true },
    description: "填写后可以按分类自动生成图片列表。",
  }),
  defineField({
    name: "limit",
    title: "最多显示图片数",
    type: "number",
    initialValue: 12,
    validation: (Rule) => Rule.min(1).max(48),
  }),
  defineField({
    name: "showTitle",
    title: "显示标题栏",
    type: "boolean",
    initialValue: true,
  }),
  defineField({
    name: "columns",
    title: "方格列数",
    type: "number",
    initialValue: 4,
    validation: (Rule) => Rule.min(2).max(6),
    hidden: ({ parent }) => parent?.style !== "grid",
  }),
  defineField({
    name: "theme",
    title: "模块主题",
    type: "string",
    options: {
      list: [
        { title: "浅色", value: "light" },
        { title: "深色", value: "dark" },
        { title: "纸张", value: "paper" },
      ],
      layout: "radio",
    },
    initialValue: "light",
  }),
  defineField({
    name: "linkLabel",
    title: "链接文字",
    type: "string",
  }),
  defineField({
    name: "linkTarget",
    title: "链接地址",
    type: "string",
    description: "例如 /journal 或 /photobalcony。",
  }),
];

export const pageLayoutType = defineType({
  name: "pageLayout",
  title: "页面布局",
  type: "document",
  fields: [
    defineField({
      name: "pageKey",
      title: "页面",
      type: "string",
      options: {
        list: [
          { title: "首页", value: "home" },
          { title: "影像阳台", value: "photobalcony" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "title",
      title: "页面标题",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "subtitle",
      title: "页面副标题",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "seoTitle",
      title: "SEO 标题",
      type: "string",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO 描述",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "heroPhoto",
      title: "页面主视觉图片",
      type: "reference",
      to: [{ type: "photo" }],
      options: { disableNew: true },
    }),
    defineField({
      name: "sections",
      title: "页面模块（拖动排序）",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "pageSection",
          title: "页面模块",
          fields: sectionFields,
          preview: {
            select: {
              title: "title",
              style: "style",
              visible: "isVisible",
              coverImage: "coverPhoto.image",
              firstImage: "photos.0.image",
            },
            prepare({ title, style, visible, coverImage, firstImage }) {
              return {
                title: title || "未命名模块",
                subtitle: `${style || "未选择样式"}${visible === false ? " / 已隐藏" : ""}`,
                media: coverImage || firstImage,
              };
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title", pageKey: "pageKey", sections: "sections" },
    prepare({ title, pageKey, sections }) {
      const count = Array.isArray(sections) ? sections.length : 0;
      const pageLabel = pageKey === "photobalcony" ? "影像阳台" : "首页";
      return { title: title || "页面布局", subtitle: `${pageLabel} / ${count} 个模块` };
    },
  },
});
