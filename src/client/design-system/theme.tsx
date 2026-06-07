import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { LIGHT, type Theme } from "./tokens";

export const ThemeCtx = createContext<Theme>(LIGHT);
export const useTheme = (): Theme => useContext(ThemeCtx);
