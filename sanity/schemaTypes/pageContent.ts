import { defineArrayMember, defineField, defineType, type ArrayOfObjectsInputProps } from "sanity";
import { BalconyChaptersInput } from "../components/BalconyChaptersInput";
import { galleryPresentations } from "../../src/lib/homepageLayout";
import { contentPageKeys, contentPages, internalPageHref, isContentPageKey } from "../../src/lib/pageContentPages";
import { balconyPresentations, isBalconyPresentation } from "../../src/lib/photobalconyLayout";
import { photoReference, photoReferenceArray } from "./photoReference";

const pages = contentPageKeys.map((value) => ({ title: contentPages[value].label, value }));

const linkFields = [
  defineField({ name: "linkPage", title: "链接到页面", type: "string", options: { list: pages } }),
  defineField({
    name: "linkTarget", title: "站内详情链接", type: "string",
    description: "链接到具体照片、手记、地图路线或页面锚点时，粘贴站内路径。两项留空时点图打开灯箱。",
    hidden: ({ parent }) => !!parent?.linkPage,
    validation: (Rule) => Rule.custom((value, { parent }) => {
      if ((parent as { linkPage?: string })?.linkPage || !value) return true;
      return internalPageHref(value) ? true : "请填写站内路径，例如 /photos/dsc-0257";
    }),
  }),
  defineField({
    name: "linkLabel", title: "链接文字", type: "string",
    hidden: ({ parent }) => !parent?.linkPage && !parent?.linkTarget,
  }),
];

function EditablePageSections(props: ArrayOfObjectsInputProps) {
  const of = props.schemaType.of.filter((type) => type.name !== "balconyPeriodSlot");
  return props.renderDefault({ ...props, schemaType: { ...props.schemaType, of } });
}

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
  title: "通栏主图",
  fields: [
    ...sectionBaseFields,
    defineField({
      name: "photo",
      title: "主视觉照片",
      ...photoReference,
      validation: (Rule) => Rule.custom((value, { parent }) =>
        (parent as { isVisible?: boolean })?.isVisible === false || !!value?._ref || "请选择照片"),
    }),
    ...linkFields,
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
      validation: (Rule) => Rule.max(3).custom((value, { parent }) => {
        if ((parent as { isVisible?: boolean })?.isVisible === false) return true;
        const cards = value as { title?: string; photo?: { _ref?: string } }[] | undefined;
        return (!!cards?.length && cards.every((card) => card.title?.trim() && card.photo?._ref)) || "请为每张卡片填写标题并选择照片";
      }),
      of: [
        defineArrayMember({
          type: "object",
          name: "featureCard",
          title: "特色卡片",
          fields: [
            defineField({ name: "title", title: "标题", type: "string" }),
            defineField({
              name: "photo",
              title: "照片",
              ...photoReference,
            }),
            ...linkFields,
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
      title: "旧版样式位置",
      type: "string",
      hidden: true,
    }),
    defineField({
      name: "presentation",
      title: "展示方式",
      type: "string",
      options: {
        list: Object.entries(galleryPresentations).map(([value, title]) => ({ title, value })),
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
      ...photoReferenceArray,
      hidden: ({ parent }) => parent?.sourceMode === "category",
      validation: (Rule) => Rule.max(48).custom((value, { parent }) => {
        const gallery = parent as { sourceMode?: string; isVisible?: boolean };
        return gallery?.isVisible === false || gallery?.sourceMode === "category" || !!value?.length || "请至少添加一张照片";
      }),
    }),
    defineField({
      name: "category",
      title: "照片分类",
      type: "reference",
      to: [{ type: "category" }],
      options: { disableNew: true, filter: "isVisible != false" },
      hidden: ({ parent }) => parent?.sourceMode !== "category",
      validation: (Rule) => Rule.custom((value, { parent }) => {
        const gallery = parent as { sourceMode?: string; isVisible?: boolean };
        return gallery?.isVisible === false || gallery?.sourceMode !== "category" || !!value?._ref || "请选择照片分类";
      }),
    }),
    defineField({
      name: "limit",
      title: "最多显示照片数",
      type: "number",
      description: "留空时，手动选择最多显示 48 张，按分类最多显示 18 张。",
      validation: (Rule) => Rule.integer().min(1).max(48),
    }),
  ],
  preview: {
    select: { title: "title", presentation: "presentation", media: "photos.0.image", visible: "isVisible", source: "sourceMode", category: "category.title", photos: "photos" },
    prepare({ title, presentation, media, visible, source, category, photos }) {
      const layout = galleryPresentations[presentation as keyof typeof galleryPresentations] || "照片画廊";
      return {
        title: title || layout,
        subtitle: visible === false ? "已隐藏" : `${layout} · ${source === "category" ? category || "未选分类" : `${photos?.length ?? 0} 张`}`,
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
      title: "旧版横幅样式",
      type: "string",
      hidden: true,
    }),
    defineField({
      name: "photo",
      title: "横幅照片",
      ...photoReference,
      validation: (Rule) => Rule.custom((value, { parent }) =>
        (parent as { isVisible?: boolean })?.isVisible === false || !!value?._ref || "请选择照片"),
    }),
    ...linkFields,
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
      ...photoReferenceArray,
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

const balconyGallery = defineArrayMember({
  name: "balconyGallery",
  title: "照片组",
  type: "object",
  initialValue: { presentation: "carousel", isVisible: true },
  fields: [
    defineField({
      name: "presentation",
      title: "版式",
      type: "string",
      options: { list: Object.entries(balconyPresentations).map(([value, title]) => ({ title, value })) },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: "isVisible", title: "显示此照片组", type: "boolean" }),
    defineField({ name: "photos", title: "照片", ...photoReferenceArray, validation: (Rule) => Rule.required().min(1) }),
  ],
  preview: {
    select: { presentation: "presentation", visible: "isVisible", photos: "photos", media: "photos.0.image" },
    prepare({ presentation, visible, photos, media }) {
      return {
        title: isBalconyPresentation(presentation) ? balconyPresentations[presentation] : "照片组",
        subtitle: `${photos?.length ?? 0} 张${visible === false ? " · 已隐藏" : ""}`,
        media,
      };
    },
  },
});

const balconyChapter = defineArrayMember({
  name: "balconyChapter",
  title: "章节",
  type: "object",
  initialValue: { isVisible: true },
  fields: [
    defineField({
      name: "title",
      title: "章节标题",
      type: "string",
      description: "填写月份、时间范围或精选主题，例如 Dec 2026。",
      validation: (Rule) => Rule.required().custom((title) => title?.trim() ? true : "请填写章节标题"),
    }),
    defineField({ name: "isVisible", title: "显示此章节", type: "boolean" }),
    defineField({ name: "galleries", title: "照片组", type: "array", of: [balconyGallery], validation: (Rule) => Rule.required().min(1) }),
  ],
  preview: {
    select: { title: "title", visible: "isVisible", galleries: "galleries", media: "galleries.0.photos.0.image" },
    prepare({ title, visible, galleries, media }) {
      const details = (galleries ?? []).map(({ presentation, photos, isVisible }: { presentation?: string; photos?: unknown[]; isVisible?: boolean }) =>
        `${isBalconyPresentation(presentation) ? balconyPresentations[presentation] : "照片组"} ${photos?.length ?? 0} 张${isVisible === false ? "（隐藏）" : ""}`,
      );
      if (visible === false) details.unshift("已隐藏");
      return { title: title || "未命名章节", subtitle: details.join(" · "), media };
    },
  },
});

const photoModules = [heroSection, featureCardsSection, gallerySection, bannerSection];

export const pageContentType = defineType({
  name: "pageContent",
  title: "页面内容（受控组件）",
  type: "document",
  fields: [
    defineField({
      name: "pageKey",
      title: "页面",
      type: "string",
      options: { list: pages },
      readOnly: true,
      validation: (Rule) => Rule.required().custom((key, { document }) => {
        const id = document?._id?.replace(/^drafts\./, "");
        return isContentPageKey(key) && id === `pageContent-${key}` ? true : "请从「页面内容」的对应页面打开编辑器";
      }),
    }),
    defineField({
      name: "title", title: "页面标题", type: "string",
      hidden: ({ document }) => !["home", "photobalcony"].includes(String(document?.pageKey)),
    }),
    defineField({
      name: "subtitle", title: "页面副标题", type: "text", rows: 3,
      hidden: ({ document }) => !["home", "photobalcony"].includes(String(document?.pageKey)),
    }),
    defineField({
      name: "heroPhoto",
      title: "页面主视觉照片",
      ...photoReference,
      hidden: ({ document }) => !["home", "photobalcony"].includes(String(document?.pageKey)),
    }),
    defineField({
      name: "modulesPosition",
      title: "照片模块位置",
      type: "string",
      description: "留空时放在页面原有内容之后。",
      options: { layout: "radio", list: [{ title: "页面原有内容之前", value: "before" }, { title: "页面原有内容之后", value: "after" }] },
      hidden: ({ document }) => !isContentPageKey(document?.pageKey) || document?.pageKey === "home",
    }),
    defineField({
      name: "sections",
      title: "内容模块",
      type: "array",
      description: "添加已有的展示方式，拖动调整顺序。摄影首页的模块显示在主视觉下方。",
      hidden: ({ document }) => document?.pageKey === "photobalcony",
      of: [...photoModules, balconyPeriodSection],
      components: { input: EditablePageSections },
    }),
    defineField({
      name: "balconyChapters",
      title: "影像阳台章节",
      type: "array",
      description: "拖动章节或组内照片以调整网页顺序。一个章节可以用多种版式。",
      hidden: ({ document }) => document?.pageKey !== "photobalcony",
      of: [balconyChapter],
      components: { input: BalconyChaptersInput },
    }),
    defineField({
      name: "extraSections",
      title: "附加照片模块",
      type: "array",
      hidden: ({ document }) => document?.pageKey !== "photobalcony",
      of: photoModules,
    }),
  ],
  preview: {
    select: { title: "title", pageKey: "pageKey", sections: "sections", chapters: "balconyChapters", extra: "extraSections" },
    prepare({ title, pageKey, sections, chapters, extra }) {
      const count = ((pageKey === "photobalcony" ? chapters ?? sections : sections)?.length ?? 0) + (extra?.length ?? 0);
      const pageLabel = isContentPageKey(pageKey) ? contentPages[pageKey].label : "页面内容";
      return { title: title || "页面内容", subtitle: `${pageLabel} / ${count} 个受控模块` };
    },
  },
});
