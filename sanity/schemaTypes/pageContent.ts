import { defineArrayMember, defineField, defineType } from "sanity";

const photoReference = defineArrayMember({
  type: "reference",
  to: [{ type: "photo" }],
  options: { disableNew: true },
});

const linkValidation = (Rule: any) =>
  Rule.custom((value: unknown) => {
    if (value === undefined || value === "") return true;
    if (typeof value !== "string") return "链接必须是站内路径";
    return value.startsWith("/") && !value.startsWith("//") ? true : "只能填写站内路径，例如 /photobalcony";
  });

const sectionBaseFields = [
  defineField({
    name: "title",
    title: "标题",
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
];

const heroSection = defineArrayMember({
  type: "object",
  name: "heroSlot",
  title: "主视觉模块",
  fields: [
    ...sectionBaseFields,
    defineField({
      name: "photo",
      title: "主视觉照片",
      type: "reference",
      to: [{ type: "photo" }],
      options: { disableNew: true },
      validation: (Rule) => Rule.required(),
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
      validation: linkValidation,
    }),
  ],
  preview: {
    select: { title: "title", media: "photo.image", visible: "isVisible" },
    prepare({ title, media, visible }) {
      return { title: title || "主视觉模块", subtitle: visible === false ? "已隐藏" : "主视觉", media };
    },
  },
});

const featureCardsSection = defineArrayMember({
  type: "object",
  name: "featureCardsSlot",
  title: "特色卡片模块",
  fields: [
    ...sectionBaseFields,
    defineField({
      name: "cards",
      title: "卡片",
      type: "array",
      validation: (Rule) => Rule.min(1).max(3),
      of: [
        defineArrayMember({
          type: "object",
          name: "featureCard",
          title: "特色卡片",
          fields: [
            defineField({ name: "title", title: "标题", type: "string", validation: (Rule) => Rule.required() }),
            defineField({
              name: "photo",
              title: "照片",
              type: "reference",
              to: [{ type: "photo" }],
              options: { disableNew: true },
              validation: (Rule) => Rule.required(),
            }),
            defineField({ name: "linkLabel", title: "链接文字", type: "string" }),
            defineField({ name: "linkTarget", title: "链接地址", type: "string", validation: linkValidation }),
          ],
          preview: {
            select: { title: "title", media: "photo.image" },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title", media: "cards.0.photo.image", visible: "isVisible" },
    prepare({ title, media, visible }) {
      return { title: title || "特色卡片模块", subtitle: visible === false ? "已隐藏" : "特色卡片", media };
    },
  },
});

const gallerySection = defineArrayMember({
  type: "object",
  name: "gallerySlot",
  title: "照片画廊模块",
  fields: [
    ...sectionBaseFields,
    defineField({
      name: "slotKey",
      title: "页面槽位",
      type: "string",
      options: {
        list: [
          { title: "Landscape", value: "landscape" },
          { title: "Quiet moments", value: "quiet" },
          { title: "City", value: "city" },
          { title: "轮播模块", value: "harborCarousel" },
          { title: "纵向堆叠模块", value: "harborStack" },
          { title: "方格模块", value: "harborSquare" },
        ],
        layout: "dropdown",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "presentation",
      title: "固定显示方式",
      type: "string",
      options: {
        list: [
          { title: "横向轮播", value: "landscapeCarousel" },
          { title: "方形横向滚动", value: "squareRail" },
          { title: "纵向堆叠", value: "stack" },
          { title: "方格组", value: "squareGrid" },
        ],
        layout: "radio",
      },
      initialValue: "landscapeCarousel",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "sourceMode",
      title: "照片来源",
      type: "string",
      options: {
        list: [
          { title: "手动选择", value: "manual" },
          { title: "按分类读取", value: "category" },
        ],
        layout: "radio",
      },
      initialValue: "manual",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "photos",
      title: "手动照片",
      type: "array",
      of: [photoReference],
      hidden: ({ parent }) => parent?.sourceMode === "category",
    }),
    defineField({
      name: "category",
      title: "照片分类",
      type: "reference",
      to: [{ type: "category" }],
      options: { disableNew: true },
      hidden: ({ parent }) => parent?.sourceMode !== "category",
    }),
    defineField({
      name: "limit",
      title: "最多显示照片数",
      type: "number",
      initialValue: 18,
      validation: (Rule) => Rule.min(1).max(48),
    }),
  ],
  preview: {
    select: { title: "title", slotKey: "slotKey", media: "photos.0.image", visible: "isVisible" },
    prepare({ title, slotKey, media, visible }) {
      const slotLabels = {
        landscape: "Landscape",
        quiet: "Quiet moments",
        city: "City",
        harborCarousel: "Harbor carousel",
        harborStack: "Harbor stack",
        harborSquare: "Harbor squares",
      };
      return {
        title: title || slotLabels[slotKey as keyof typeof slotLabels] || "照片画廊模块",
        subtitle: visible === false ? "已隐藏" : "照片画廊",
        media,
      };
    },
  },
});

const bannerSection = defineArrayMember({
  type: "object",
  name: "bannerSlot",
  title: "横幅模块",
  fields: [
    ...sectionBaseFields,
    defineField({
      name: "slotKey",
      title: "模块用途",
      type: "string",
      options: {
        list: [
          { title: "普通横幅", value: "bannerOne" },
          { title: "Harbor 主图", value: "harbor" },
        ],
        layout: "dropdown",
      },
      initialValue: "bannerOne",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "photo",
      title: "横幅照片",
      type: "reference",
      to: [{ type: "photo" }],
      options: { disableNew: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "linkLabel", title: "链接文字", type: "string" }),
    defineField({ name: "linkTarget", title: "链接地址", type: "string", validation: linkValidation }),
  ],
  preview: {
    select: { title: "title", slotKey: "slotKey", media: "photo.image", visible: "isVisible" },
    prepare({ title, slotKey, media, visible }) {
      return {
        title: title || (slotKey === "harbor" ? "Harbor" : "横幅模块"),
        subtitle: visible === false ? "已隐藏" : "横幅",
        media,
      };
    },
  },
});

const balconyPeriodSection = defineArrayMember({
  type: "object",
  name: "balconyPeriodSlot",
  title: "Photobalcony 时间段",
  fields: [
    defineField({
      name: "periodKey",
      title: "时间段",
      type: "string",
      options: {
        list: [
          { title: "2026", value: "may" },
          { title: "Jul 2026 竖幅", value: "marchPortraits" },
          { title: "Jul 2026 横幅", value: "marchWide" },
          { title: "May - Jun 2026", value: "february" },
          { title: "Apr 2026", value: "january" },
          { title: "Mar 2026", value: "winter" },
          { title: "Jan - Feb 2026", value: "summer" },
        ],
        layout: "dropdown",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "title", title: "标题", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "isVisible", title: "显示此时间段", type: "boolean", initialValue: true }),
    defineField({
      name: "photos",
      title: "照片",
      type: "array",
      of: [photoReference],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: { title: "title", periodKey: "periodKey", visible: "isVisible", media: "photos.0.image" },
    prepare({ title, periodKey, visible, media }) {
      return { title: title || periodKey || "时间段", subtitle: visible === false ? "已隐藏" : "已配置", media };
    },
  },
});

export const pageContentType = defineType({
  name: "pageContent",
  title: "页面内容（受控组件）",
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
    defineField({ name: "title", title: "页面标题", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "subtitle", title: "页面副标题", type: "text", rows: 3 }),
    defineField({
      name: "heroPhoto",
      title: "页面主视觉照片",
      type: "reference",
      to: [{ type: "photo" }],
      options: { disableNew: true },
    }),
    defineField({
      name: "sections",
      title: "内容模块",
      type: "array",
      description: "只能使用已实现的受控组件；模块顺序按此列表保存。",
      of: [heroSection, featureCardsSection, gallerySection, bannerSection, balconyPeriodSection],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: { title: "title", pageKey: "pageKey", sections: "sections" },
    prepare({ title, pageKey, sections }) {
      const count = Array.isArray(sections) ? sections.length : 0;
      const pageLabel = pageKey === "photobalcony" ? "影像阳台" : "首页";
      return { title: title || "页面内容", subtitle: `${pageLabel} / ${count} 个受控模块` };
    },
  },
});
