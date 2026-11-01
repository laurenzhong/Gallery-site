import type { StructureResolver } from "sanity/structure";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { PhotoImportDashboard } from "./components/PhotoImportDashboard";
import { PhotoLibraryDashboard } from "./components/PhotoLibraryDashboard";

const photoOrdering = [{ field: "sortOrder", direction: "asc" as const }];
const storyOrdering = [{ field: "orderRank", direction: "asc" as const }];

const li = (S: Parameters<StructureResolver>[0], id: string) => S.listItem().id(id);

const safeId = (value: string) => {
  const ascii = value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  if (ascii) return ascii;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `c${(hash >>> 0).toString(36)}`;
};

const photoList = (
  S: Parameters<StructureResolver>[0],
  title: string,
  filter = '_type == "photo"',
) => S.documentTypeList("photo").title(title).filter(filter).defaultOrdering(photoOrdering);

const storyList = (
  S: Parameters<StructureResolver>[0],
  title: string,
  filter = '_type == "story"',
) => S.documentTypeList("story").title(title).filter(filter).defaultOrdering(storyOrdering);

const categoryPhotoItem = (S: Parameters<StructureResolver>[0], title: string) =>
  li(S, `photos.category.${safeId(title)}`)
    .title(title)
    .schemaType("photo")
    .child(photoList(S, title, '_type == "photo" && category->title == $category').params({ category: title }));

const pageDocument = (
  S: Parameters<StructureResolver>[0],
  schemaType: string,
  documentId: string,
  title: string,
) =>
  S.document().schemaType(schemaType).documentId(documentId).title(title);

// A photo is actionable when it is missing an essential field or is visible but
// has not been placed on a controlled page or in a story yet.
const photoNeedsAttentionFilter = `
  _type == "photo" &&
  (
    !defined(image.asset._ref) ||
    !defined(category._ref) ||
    !defined(slug.current) ||
    (
      isHidden != true &&
      count(*[_type in ["pageContent", "homepageLayout", "photobalconyLayout", "siteSettings", "story"] && references(^._id)]) == 0
    )
  )
`;

const pageUsedPhotoFilter = (pageKey: "home" | "photobalcony") => `
  _type == "photo" &&
  count(*[
    ((_type == "pageContent" && pageKey == "${pageKey}") ||
      (_type == "homepageLayout" && "${pageKey}" == "home") ||
      (_type == "photobalconyLayout" && "${pageKey}" == "photobalcony")) &&
    references(^._id)
  ]) > 0
`;

const storyUsedPhotoFilter = `
  _type == "photo" &&
  count(*[_type == "story" && references(^._id)]) > 0
`;

export const structure: StructureResolver = (S, context) =>
  S.list()
    .id("gallery")
    .title("Gallery 内容管理")
    .items([
      li(S, "pages")
        .title("页面内容")
        .child(
          S.list()
            .id("pages-list")
            .title("页面内容")
            .items([
              li(S, "pages.home")
                .title("首页")
                .schemaType("pageContent")
                .child(pageDocument(S, "pageContent", "pageContent-home", "首页内容")),
              li(S, "pages.photobalcony")
                .title("影像阳台")
                .schemaType("pageContent")
                .child(pageDocument(S, "pageContent", "pageContent-photobalcony", "影像阳台内容")),
              S.divider(),
              li(S, "pages.site-copy")
                .title("全站文字")
                .schemaType("siteCopy")
                .child(pageDocument(S, "siteCopy", "siteCopy-main", "全站文字")),
              li(S, "pages.site-settings")
                .title("网站设置")
                .schemaType("siteSettings")
                .child(pageDocument(S, "siteSettings", "siteSettings-main", "网站设置")),
            ]),
        ),
      li(S, "photos")
        .title("照片库")
        .child(
          S.list()
            .id("photos-list")
            .title("照片库")
            .items([
              li(S, "photos.import")
                .title("导入照片")
                .child(S.component(PhotoImportDashboard).id("photos-import-dashboard").title("导入照片")),
              S.divider(),
              li(S, "photos.all")
                .title("全部照片")
                .schemaType("photo")
                .child(S.component(PhotoLibraryDashboard).id("photos-all-dashboard").title("全部照片")),
              li(S, "photos.needs-attention")
                .title("需要补全")
                .schemaType("photo")
                .child(photoList(S, "需要补全", photoNeedsAttentionFilter)),
              li(S, "photos.used-in")
                .title("按页面使用")
                .child(
                  S.list()
                    .id("photos-used-in-list")
                    .title("按页面使用")
                    .items([
                      li(S, "photos.used-in.home")
                        .title("首页使用的照片")
                        .schemaType("photo")
                        .child(photoList(S, "首页使用的照片", pageUsedPhotoFilter("home"))),
                      li(S, "photos.used-in.photobalcony")
                        .title("影像阳台使用的照片")
                        .schemaType("photo")
                        .child(photoList(S, "影像阳台使用的照片", pageUsedPhotoFilter("photobalcony"))),
                      li(S, "photos.used-in.journal")
                        .title("手记使用的照片")
                        .schemaType("photo")
                        .child(photoList(S, "手记使用的照片", storyUsedPhotoFilter)),
                    ]),
                ),
              li(S, "photos.categories")
                .title("按分类浏览")
                .child(
                  S.list()
                    .id("photos-categories-list")
                    .title("按分类浏览")
                    .items([
                      li(S, "photos.categories.all")
                        .title("全部分类")
                        .schemaType("category")
                        .child(S.documentTypeList("category").title("全部分类")),
                      S.divider(),
                      categoryPhotoItem(S, "山野"),
                      categoryPhotoItem(S, "建筑"),
                      categoryPhotoItem(S, "日出日落"),
                      categoryPhotoItem(S, "森林"),
                      categoryPhotoItem(S, "河流"),
                      categoryPhotoItem(S, "海洋"),
                      categoryPhotoItem(S, "石塘度假区"),
                      categoryPhotoItem(S, "花朵"),
                    ]),
                ),
            ]),
        ),
      li(S, "journal")
        .title("手记")
        .child(
          S.list()
            .id("journal-list")
            .title("手记")
            .items([
              orderableDocumentListDeskItem({
                type: "story",
                id: "journal.all",
                title: "全部手记",
                S,
                context,
              }),
              li(S, "journal.missing-cover")
                .title("需要补封面")
                .schemaType("story")
                .child(storyList(S, "需要补封面", '_type == "story" && !defined(coverPhoto._ref)')),
            ]),
        ),
      li(S, "publishing")
        .title("发布检查")
        .child(
          S.list()
            .id("publishing-list")
            .title("发布检查")
            .items([
              li(S, "publishing.hidden-photos")
                .title("已隐藏但仍被使用的照片")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "已隐藏但仍被使用的照片",
                    '_type == "photo" && isHidden == true && count(*[_type in ["pageContent", "homepageLayout", "photobalconyLayout", "siteSettings", "story"] && references(^._id)]) > 0',
                  ),
                ),
              li(S, "publishing.visible-stories-missing-cover")
                .title("公开手记缺少封面")
                .schemaType("story")
                .child(
                  storyList(
                    S,
                    "公开手记缺少封面",
                    '_type == "story" && isHidden != true && (!defined(publishedAt) || dateTime(publishedAt) <= dateTime(now())) && !defined(coverPhoto._ref)',
                  ),
                ),
            ]),
        ),
    ]);
