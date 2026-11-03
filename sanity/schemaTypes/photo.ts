import { defineArrayMember, defineField, defineType } from "sanity";
import { PhotoReadinessInput } from "../components/PhotoReadinessInput";
import { PhotoUsageInput } from "../components/PhotoUsageInput";
import { photoConditionOptions, photoSubjectOptions } from "../photoTaxonomy";

const usageWarningQuery = `{
  "homepageCount": count(*[
    _type == "homepageLayout" &&
    (references($publishedId) || references($draftId))
  ]),
  "siteHeroCount": count(*[
    _type == "siteSettings" &&
    (heroPhoto._ref == $publishedId || heroPhoto._ref == $draftId)
  ]),
  "photobalconyCount": count(*[
    _type == "photobalconyLayout" &&
    (references($publishedId) || references($draftId))
  ]),
  "visibleStoryCount": count(*[
    _type == "story" &&
    isHidden != true &&
    (references($publishedId) || references($draftId))
  ])
}`;

function documentIds(id: string | undefined) {
  const publishedId = id?.replace(/^drafts\./, "");
  return {
    publishedId: publishedId ?? "",
    draftId: publishedId ? `drafts.${publishedId}` : "",
  };
}

export const photoType = defineType({
  name: "photo",
  title: "照片",
  type: "document",
  fieldsets: [
    {
      name: "placement",
      title: "网站位置",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "identity",
      title: "照片信息",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "classification",
      title: "内容分类",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "metadata",
      title: "拍摄参数",
      options: { collapsible: true, collapsed: true },
    },
    {
      name: "safety",
      title: "迁移与保护",
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    defineField({
      name: "title",
      title: "名称",
      type: "string",
      fieldset: "identity",
      description: "显示在灯箱、照片详情页、站点标题数据以及 Studio 预览中。",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL 标识",
      type: "slug",
      fieldset: "identity",
      options: { source: "title", maxLength: 96 },
      description: "用于照片详情/灯箱页 URL 的稳定地址段，分享链接后请勿修改。",
      validation: (Rule) =>
        Rule.required().custom(async (value, context) => {
          if (!value?.current) return true;
          const documentId = context.document?._id?.replace(/^drafts\./, "");
          const client = context.getClient({ apiVersion: "2025-02-19" });
          const duplicateCount = await client.fetch<number>(
            `count(*[_type == "photo" && slug.current == $slug && !(_id in [$publishedId, $draftId])])`,
            {
              slug: value.current,
              publishedId: documentId ?? "",
              draftId: documentId ? `drafts.${documentId}` : "",
            },
          );
          return duplicateCount ? "此 URL 标识已被其他照片使用。" : true;
        }),
    }),
    defineField({
      name: "image",
      title: "图片",
      type: "image",
      fieldset: "identity",
      options: { hotspot: true, metadata: ["blurhash", "lqip", "palette"] },
      description:
        "在此上传或替换照片资源。是否出现在网站，由页面实际引用和下方的「是否隐藏」共同决定。",
    }),
    defineField({
      name: "altText",
      title: "替代文本",
      type: "string",
      fieldset: "identity",
      description: "用于图片无障碍和搜索引擎。请描述画面内容，建议控制在 160 个字符以内。",
      validation: (Rule) => Rule.max(160).warning("替代文本过长，建议控制在 160 个字符以内。"),
    }),
    defineField({
      name: "caption",
      title: "图片说明",
      type: "text",
      rows: 2,
      fieldset: "identity",
      description: "可选的图片说明，会用于照片详情和灯箱信息。",
    }),
    defineField({
      name: "credit",
      title: "署名 / 版权",
      type: "string",
      fieldset: "identity",
      description: "可选的摄影师署名或版权说明。",
    }),
    defineField({
      name: "subjects",
      title: "主体标签",
      type: "array",
      fieldset: "classification",
      of: [{ type: "string" }],
      options: { list: [...photoSubjectOptions] },
      description:
        "描述画面中值得被搜索的主体，可选择多个。例如花朵前景、山体背景可以同时选择「花朵」和「山体」。建议控制在 1–5 个。",
      validation: (Rule) => Rule.unique().max(5),
    }),
    defineField({
      name: "primarySubject",
      title: "主主体（可选）",
      type: "string",
      fieldset: "classification",
      options: { list: [...photoSubjectOptions] },
      description: "只有在需要显示一个主标签或排序时选择；主体同等重要时可以留空。",
    }),
    defineField({
      name: "conditions",
      title: "时间 / 天气",
      type: "array",
      fieldset: "classification",
      of: [{ type: "string" }],
      options: { list: [...photoConditionOptions] },
      description: "可选。只在画面或 EXIF 能明确判断时填写。",
      validation: (Rule) => Rule.unique().max(4),
    }),
    defineField({
      name: "place",
      title: "地点标签",
      type: "reference",
      fieldset: "classification",
      to: [{ type: "place" }],
      description: "用于照片库筛选的宽泛地点，例如“麦理浩径”。",
      options: { disableNew: true },
    }),
    defineField({
      name: "spot",
      title: "具体拍摄点",
      type: "string",
      fieldset: "classification",
      description: "用于标题和手记的具体地点，例如“破边洲”。",
    }),
    defineField({
      name: "aiClassification",
      title: "AI 分类建议",
      type: "object",
      fieldset: "classification",
      readOnly: true,
      description: "由服务端视觉模型生成的标签、标题、说明和手记任务记录。",
      fields: [
        defineField({
          name: "status",
          title: "状态",
          type: "string",
          options: {
            list: [
              { title: "等待处理", value: "queued" },
              { title: "处理中", value: "processing" },
              { title: "待确认", value: "suggested" },
              { title: "已应用", value: "approved" },
              { title: "失败", value: "error" },
            ],
          },
        }),
        defineField({ name: "model", title: "模型", type: "string" }),
        defineField({
          name: "subjects",
          title: "主体建议",
          type: "array",
          of: [
            defineArrayMember({
              type: "object",
              fields: [
                defineField({ name: "value", title: "标签", type: "string" }),
                defineField({ name: "confidence", title: "置信度", type: "number" }),
              ],
              preview: { select: { title: "value", confidence: "confidence" }, prepare: ({ title, confidence }) => ({ title, subtitle: confidence == null ? undefined : `${Math.round(confidence * 100)}%` }) },
            }),
          ],
        }),
        defineField({
          name: "conditions",
          title: "时间 / 天气建议",
          type: "array",
          of: [
            defineArrayMember({
              type: "object",
              fields: [
                defineField({ name: "value", title: "标签", type: "string" }),
                defineField({ name: "confidence", title: "置信度", type: "number" }),
              ],
              preview: { select: { title: "value", confidence: "confidence" }, prepare: ({ title, confidence }) => ({ title, subtitle: confidence == null ? undefined : `${Math.round(confidence * 100)}%` }) },
            }),
          ],
        }),
        defineField({ name: "primarySubject", title: "主主体建议", type: "string" }),
        defineField({ name: "title", title: "标题建议", type: "string" }),
        defineField({ name: "altText", title: "替代文本建议", type: "string" }),
        defineField({ name: "caption", title: "说明建议", type: "text", rows: 2 }),
        defineField({ name: "storyId", title: "生成的手记", type: "string" }),
        defineField({ name: "prompt", title: "手记提示词", type: "text", rows: 3 }),
        defineField({ name: "generateStory", title: "生成手记", type: "boolean" }),
        defineField({ name: "processedAt", title: "处理时间", type: "datetime" }),
        defineField({ name: "error", title: "错误信息", type: "text", rows: 2 }),
      ],
    }),
    defineField({
      name: "category",
      title: "旧版展示栏目（可选）",
      type: "reference",
      fieldset: "placement",
      to: [{ type: "category" }],
      description:
        "保留给旧页面和已有数据使用。新照片使用主体标签和地点标签，不要依赖旧栏目。",
    }),
    defineField({
      name: "sortOrder",
      title: "排序值",
      type: "number",
      fieldset: "placement",
      initialValue: 100,
      description:
        "数值越小，在当前分类/首页中的位置越靠前。删除或重新上传照片前，建议先调整此值。",
    }),
    defineField({
      name: "isHidden",
      title: "从网站隐藏",
      type: "boolean",
      fieldset: "placement",
      initialValue: false,
      description:
        "在不删除文档的前提下，将这张照片从线上网站隐藏。当某篇手记可能引用了此照片时，推荐使用此方式。",
      validation: (Rule) =>
        Rule.custom(async (value, context) => {
          if (!value) return true;
          const client = context.getClient({ apiVersion: "2025-02-19" });
          const usage = await client.fetch<{
            homepageCount: number;
            siteHeroCount: number;
            photobalconyCount: number;
            visibleStoryCount: number;
          }>(usageWarningQuery, documentIds(context.document?._id));
          const warnings = [];
          if (usage.siteHeroCount) warnings.push("站点设置主视觉");
          if (usage.homepageCount) warnings.push("首页布局");
          if (usage.photobalconyCount) warnings.push("影像阳台布局");
          if (usage.visibleStoryCount) warnings.push(`${usage.visibleStoryCount} 篇可见手记`);
          if (!warnings.length) return true;

          return `此照片仍被 ${warnings.join("、")} 引用。继续隐藏可能会让它从线上页面消失或触发兜底图片。`;
        }).warning(),
    }),
    defineField({
      name: "isHero",
      title: "首页主视觉备选标记",
      type: "boolean",
      fieldset: "placement",
      initialValue: false,
      description:
        "首页主视觉的兜底标记。真正的主视觉由「首页 → 站点设置 / 主视觉」控制。请最多保持一张照片标记为 true。",
      validation: (Rule) =>
        Rule.custom(async (value, context) => {
          if (!value) return true;
          const client = context.getClient({ apiVersion: "2025-02-19" });
          const currentId = context.document?._id;
          const publishedId = currentId?.replace(/^drafts\./, "");
          const draftId = publishedId ? `drafts.${publishedId}` : undefined;
          const others = await client.fetch(
            `count(*[
              _type == "photo" &&
              isHero == true &&
              _id != $publishedId &&
              _id != $draftId
            ])`,
            { publishedId: publishedId ?? "", draftId: draftId ?? "" },
          );
          if (others > 0) {
            return "已有其他照片标记为首页主视觉备选；同时只应保留一张照片作为兜底主视觉。";
          }
          return true;
        }),
    }),
    defineField({
      name: "isFeatured",
      title: "精选标记（保留字段）",
      type: "boolean",
      fieldset: "placement",
      initialValue: false,
      description: "预留给未来「精选模块」编辑器使用；当前首页布局未使用此标记。",
    }),
    defineField({
      name: "date",
      title: "拍摄日期",
      type: "date",
      fieldset: "identity",
      description: "在排序值相同的情况下，作为次级排序依据。",
    }),
    defineField({
      name: "location",
      title: "拍摄地点",
      type: "string",
      fieldset: "identity",
    }),
    defineField({
      name: "camera",
      title: "相机",
      type: "string",
      fieldset: "metadata",
    }),
    defineField({
      name: "lens",
      title: "镜头",
      type: "string",
      fieldset: "metadata",
    }),
    defineField({
      name: "aperture",
      title: "光圈",
      type: "string",
      fieldset: "metadata",
    }),
    defineField({
      name: "shutter",
      title: "快门",
      type: "string",
      fieldset: "metadata",
    }),
    defineField({
      name: "iso",
      title: "感光度",
      type: "number",
      fieldset: "metadata",
    }),
    defineField({
      name: "focalLength",
      title: "焦距",
      type: "string",
      fieldset: "metadata",
    }),
    defineField({
      name: "readinessSummary",
      title: "照片发布就绪状态",
      type: "string",
      fieldset: "safety",
      readOnly: true,
      description: "Studio 只读辅助信息，不会保存为内容。",
      components: {
        input: PhotoReadinessInput,
      },
    }),
    defineField({
      name: "usageSummary",
      title: "照片使用情况",
      type: "string",
      fieldset: "safety",
      readOnly: true,
      description: "Studio 只读辅助信息，不会保存为内容。",
      components: {
        input: PhotoUsageInput,
      },
    }),
    defineField({
      name: "sourceFilename",
      title: "原始文件名",
      type: "string",
      fieldset: "safety",
      description:
        "前端仍按文件名映射少量固定的首页位置，请保持此字段稳定。",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "legacyId",
      title: "旧版编号",
      type: "string",
      fieldset: "safety",
      readOnly: true,
    }),
    defineField({
      name: "legacyPublicPath",
      title: "旧版公开路径",
      type: "string",
      fieldset: "safety",
      readOnly: true,
      description: "在 Sanity 图片资源上传完成前，供迁移脚本与前端兜底使用。",
    }),
    defineField({
      name: "legacyLocalPath",
      title: "旧版本地路径",
      type: "string",
      fieldset: "safety",
      readOnly: true,
    }),
    defineField({
      name: "dimensions",
      title: "尺寸",
      type: "object",
      fieldset: "safety",
      readOnly: true,
      fields: [
        defineField({ name: "width", title: "宽", type: "number" }),
        defineField({ name: "height", title: "高", type: "number" }),
      ],
    }),
  ],
  orderings: [
    {
      title: "最近导入",
      name: "createdAtDesc",
      by: [{ field: "_createdAt", direction: "desc" }],
    },
    {
      title: "最新优先",
      name: "dateDesc",
      by: [{ field: "date", direction: "desc" }],
    },
    {
      title: "按排序值",
      name: "sortOrderAsc",
      by: [{ field: "sortOrder", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      filename: "sourceFilename",
      category: "category.title",
      subjects: "subjects",
      hidden: "isHidden",
      hero: "isHero",
      order: "sortOrder",
      media: "image",
    },
    prepare({
      title,
      filename,
      category,
      subjects,
      hidden,
      hero,
      order,
      media,
    }) {
      const status = hidden ? "已隐藏" : hero ? "主视觉备选" : "正常显示";
      const details = [
        subjects?.length ? subjects.join("、") : category,
        status,
        order != null ? `排序 ${order}` : null,
        filename,
      ]
        .filter(Boolean)
        .join(" / ");

      return {
        title,
        subtitle: details,
        media,
      };
    },
  },
});
