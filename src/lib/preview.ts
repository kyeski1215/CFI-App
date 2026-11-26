// "Preview as student": the student screens rendered from your device, read-only.
import { createContext, useContext } from "react";
import type { Activity } from "./activity";
import type { StudentCard } from "./card";

export interface Preview { card: StudentCard; act: Activity; base: string; blocked: () => void }
export const PreviewCtx = createContext<Preview | null>(null);
export const usePreview = () => useContext(PreviewCtx);
/** Where student links point: "/me" for a signed-in student, "/preview/<id>" in a preview. */
export const useStudentBase = () => useContext(PreviewCtx)?.base ?? "/me";
