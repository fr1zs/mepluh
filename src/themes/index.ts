import { amdAdrenalinTheme } from "./amdAdrenalin";
import { catppuccinThemes } from "./catppuccin/generate";
import { oledTheme } from "./oled";
import type { BuiltinTheme } from "./themeFile";
import { transparencyTheme } from "./transparency";

export const builtinThemes: readonly BuiltinTheme[] = [amdAdrenalinTheme, oledTheme, transparencyTheme, ...catppuccinThemes];