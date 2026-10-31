import { createContext, useContext } from "react";
import { defaultSiteCopy, type SiteCopy } from "./siteCopy";

export const SiteCopyContext = createContext<SiteCopy>(defaultSiteCopy);

export function useSiteCopy() {
  return useContext(SiteCopyContext);
}
