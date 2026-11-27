import { defineArrayMember } from "sanity";
import { PhotoArrayInput, PhotoReferenceInput } from "../components/PhotoReferenceInput";

export const photoReference = {
  type: "reference" as const,
  to: [{ type: "photo" }],
  options: { disableNew: true },
  components: { input: PhotoReferenceInput },
};

export const photoReferenceArray = {
  type: "array" as const,
  of: [defineArrayMember(photoReference)],
  components: { input: PhotoArrayInput },
};
