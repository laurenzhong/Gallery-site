import { Button, Card, Stack, Text } from "@sanity/ui";
import { PatchEvent, set, useFormValue, type ArrayOfObjectsInputProps } from "sanity";
import { balconyPresentations, chaptersFromLegacyBalcony, type PhotobalconyPeriodKey } from "../../src/lib/photobalconyLayout";

type LegacyPeriod = {
  _key: string;
  _type: string;
  periodKey?: PhotobalconyPeriodKey;
  title?: string;
  isVisible?: boolean;
  photos?: { _key: string; _type: "reference"; _ref: string }[];
};

export function BalconyChaptersInput(props: ArrayOfObjectsInputProps) {
  const sections = useFormValue(["sections"]) as LegacyPeriod[] | undefined;
  if (props.value) return props.renderDefault({
    ...props,
    onChange: (change) => props.onChange(PatchEvent.from(PatchEvent.from(change).patches.map((patch) =>
      patch.type === "unset" && !patch.path.length ? set([]) : patch,
    ))),
  });

  const chapters = chaptersFromLegacyBalcony((sections ?? []).flatMap((section) =>
    section._type === "balconyPeriodSlot" && section.periodKey && section.photos?.length
      ? [{ id: section._key, key: section.periodKey, title: section.title || section.periodKey, photos: section.photos, isVisible: section.isVisible }]
      : [],
  ));
  if (!chapters.length) return props.renderDefault(props);

  return (
    <Card padding={3} radius={2} border>
      <Stack space={4}>
        <Text size={1}>载入现有内容后，可调整以下章节的版式、顺序和照片，并用「草稿预览」核对。</Text>
        {chapters.map((chapter) => (
          <Text key={chapter.id} size={1} muted>
            {chapter.title} · {chapter.galleries.map((gallery) =>
              `${balconyPresentations[gallery.presentation]} ${gallery.photos.length} 张${gallery.isVisible === false ? "（隐藏）" : ""}`,
            ).join(" / ")}
          </Text>
        ))}
        <Button text="载入现有章节" mode="ghost" tone="primary" disabled={props.readOnly} onClick={() => {
          props.onChange(set(chapters.map(({ id, title, galleries }) => ({
            _key: id,
            _type: "balconyChapter",
            title,
            isVisible: true,
            galleries: galleries.map(({ id: galleryId, presentation, isVisible, photos }) => ({
              _key: galleryId,
              _type: "balconyGallery",
              presentation,
              isVisible: isVisible !== false,
              photos,
            })),
          }))));
        }} />
      </Stack>
    </Card>
  );
}
