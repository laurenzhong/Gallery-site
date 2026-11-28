import type { StructureResolver } from "sanity/structure";
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { PhotoImportDashboard } from "./components/PhotoImportDashboard";
import { PhotoLibraryDashboard } from "./components/PhotoLibraryDashboard";
import { PhotoMapEditorDashboard } from "./components/PhotoMapEditorDashboard";
import { PageDraftPreview } from "./components/PageDraftPreview";
import { PagePhotoUsage } from "./components/PhotoUsageInput";
import { contentPageKeys, contentPages } from "../src/lib/pageContentPages";

const photoOrdering = [{ field: "sortOrder", direction: "asc" as const }];
const storyOrdering = [{ field: "orderRank", direction: "asc" as const }];

const li = (S: Parameters<StructureResolver>[0], id: string) => S.listItem().id(id);

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

const pageDocument = (
  S: Parameters<StructureResolver>[0],
  schemaType: string,
  documentId: string,
  title: string,
) =>
  S.document().schemaType(schemaType).documentId(documentId).title(title);

const photoNeedsAttentionFilter = `
  _type == "photo" &&
  (
    !defined(image.asset._ref) ||
    (!defined(category._ref) && coalesce(count(subjects), 0) == 0) ||
    !defined(slug.current)
  )
`;

const storyUsedPhotoFilter = `
  _type == "photo" &&
  count(*[_type == "story" && references(^._id)]) > 0
`;

export const galleryStructure = (previewOrigin: string): StructureResolver => (S, context) =>
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
              ...contentPageKeys.map((key) => li(S, `pages.${key}`)
                .title(contentPages[key].label)
                .schemaType("pageContent")
                .child(pageDocument(S, "pageContent", `pageContent-${key}`, contentPages[key].label)
                .initialValueTemplate(`pageContent-${key}`)
                .views([
                  S.view.form().title("编辑内容"),
                  S.view.component(PageDraftPreview).id("page-preview").title("草稿预览").options({ origin: previewOrigin, pageKey: key }),
                ]))),
              S.divider(),
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
                .child(
                  S.component(PhotoLibraryDashboard)
                    .id("photos-all-dashboard")
                    .title("全部照片")
                    .child((documentId) => S.defaultDocument({ schemaType: "photo", documentId })),
                ),

              li(S, "photos.albums")
                .title("相册")
                .schemaType("album")
                .child(S.documentTypeList("album").title("相册").defaultOrdering([{ field: "sortOrder", direction: "asc" }])),
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
                      ...contentPageKeys.map((key) => li(S, `photos.used-in.page-${key}`)
                        .title(contentPages[key].label)
                        .child(S.component(PagePhotoUsage).id(`photos-on-${key}`).title(contentPages[key].label).options({ pageKey: key }))),
                      li(S, "photos.used-in.stories")
                        .title("手记文档引用")
                        .schemaType("photo")
                        .child(photoList(S, "手记文档引用", storyUsedPhotoFilter)),
                    ]),
                ),
              li(S, "photos.places")
                .title("地点")
                .schemaType("place")
                .child(S.documentTypeList("place").title("地点")),
            ]),
        ),
      li(S, "map")
        .title("地图")
        .child(
          S.list()
            .id("map-list")
            .title("地图")
            .items([
              li(S, "map.photo-map")
                .title("照片地图")
                .child(S.component(PhotoMapEditorDashboard).id("photo-map-editor").title("照片地图")),
              li(S, "map.routes")
                .title("地图路线")
                .schemaType("mapRoute")
                .child(S.documentTypeList("mapRoute").title("地图路线").defaultOrdering([{ field: "_updatedAt", direction: "desc" }])),
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
                .title("已隐藏但仍有文档引用")
                .schemaType("photo")
                .child(
                  photoList(
                    S,
                    "已隐藏但仍有文档引用",
                    '_type == "photo" && isHidden == true && count(*[_type in ["pageContent", "homepageLayout", "photobalconyLayout", "siteSettings", "story", "mapRoute"] && references(^._id)]) > 0',
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
