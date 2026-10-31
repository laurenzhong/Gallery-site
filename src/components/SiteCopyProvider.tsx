import type { PropsWithChildren } from "react";
import { SiteCopyContext } from "../lib/siteCopyContext";
import type { SiteCopy } from "../lib/siteCopy";

export function SiteCopyProvider({ copy, children }: PropsWithChildren<{ copy: SiteCopy }>) {
  return <SiteCopyContext.Provider value={copy}>{children}</SiteCopyContext.Provider>;
}
