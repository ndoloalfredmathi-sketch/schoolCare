import { pdf } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { savePdfFile } from "./api";

type DocumentElement = NonNullable<Parameters<typeof pdf>[0]>;

export async function savePdf(
  element: ReactElement,
  filename: string,
): Promise<string | null> {
  const blob = await pdf(element as DocumentElement).toBlob();

  return savePdfFile(filename, await blob.arrayBuffer());
}
