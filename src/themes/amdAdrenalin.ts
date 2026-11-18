import { renderHeader, type BuiltinTheme } from "./themeFile";

const header = renderHeader({
    name: "AMD Adrenalin Red",
    description: "Changes the primary Medal accent color to match the AMD Adrenalin App colors.",
    author: "fr1zs",
    version: "1.0.0"
});

export const amdAdrenalinTheme: BuiltinTheme = {
    fileName: "amd-adrenalin-red.theme.css",
    css: `${header}

:root,
:host {
    /* AMD Adrenalin Brand & Accent Palette */
    --amd-red-primary: #ed1c24;
    --amd-red-hover: #d80008;
    --amd-red-active: #b90007;
    --amd-red-soft: #ff4d54;
    --amd-green: #22c55e;
    --amd-amber: #f59e0b;
    --amd-dark-mix: #0a0a0c;

    --amd-accent: var(--amd-red-primary);

    /* Primary Brand (Buttons, Active Toggles, Highlights) */
    --color-brand-primary-50: color-mix(in oklab, var(--amd-accent) 14%, #ffffff);
    --color-brand-primary-100: color-mix(in oklab, var(--amd-accent) 28%, #ffffff);
    --color-brand-primary-200: color-mix(in oklab, var(--amd-accent) 46%, #ffffff);
    --color-brand-primary-300: color-mix(in oklab, var(--amd-accent) 64%, #ffffff);
    --color-brand-primary-400: color-mix(in oklab, var(--amd-accent) 84%, #ffffff);
    --color-brand-primary-500: var(--amd-accent);
    --color-brand-primary-600: var(--amd-red-hover);
    --color-brand-primary-700: var(--amd-red-active);
    --color-brand-primary-800: color-mix(in oklab, var(--amd-accent) 54%, var(--amd-dark-mix));
    --color-brand-primary-900: color-mix(in oklab, var(--amd-accent) 42%, var(--amd-dark-mix));
    --color-brand-primary-950: color-mix(in oklab, var(--amd-accent) 26%, var(--amd-dark-mix));

    /* Secondary Brand (Crimson / Scarlet Accents) */
    --color-brand-secondary-50: color-mix(in oklab, var(--amd-red-hover) 14%, #ffffff);
    --color-brand-secondary-100: color-mix(in oklab, var(--amd-red-hover) 28%, #ffffff);
    --color-brand-secondary-200: color-mix(in oklab, var(--amd-red-hover) 46%, #ffffff);
    --color-brand-secondary-300: color-mix(in oklab, var(--amd-red-hover) 64%, #ffffff);
    --color-brand-secondary-400: color-mix(in oklab, var(--amd-red-hover) 84%, #ffffff);
    --color-brand-secondary-500: var(--amd-red-hover);
    --color-brand-secondary-600: var(--amd-red-active);
    --color-brand-secondary-700: color-mix(in oklab, var(--amd-red-hover) 68%, var(--amd-dark-mix));
    --color-brand-secondary-800: color-mix(in oklab, var(--amd-red-hover) 54%, var(--amd-dark-mix));
    --color-brand-secondary-900: color-mix(in oklab, var(--amd-red-hover) 42%, var(--amd-dark-mix));
    --color-brand-secondary-950: color-mix(in oklab, var(--amd-red-hover) 26%, var(--amd-dark-mix));

    /* Tertiary Brand (Scarlet) */
    --color-brand-tertiary-50: color-mix(in oklab, var(--amd-red-soft) 14%, #ffffff);
    --color-brand-tertiary-100: color-mix(in oklab, var(--amd-red-soft) 28%, #ffffff);
    --color-brand-tertiary-200: color-mix(in oklab, var(--amd-red-soft) 46%, #ffffff);
    --color-brand-tertiary-300: color-mix(in oklab, var(--amd-red-soft) 64%, #ffffff);
    --color-brand-tertiary-400: color-mix(in oklab, var(--amd-red-soft) 84%, #ffffff);
    --color-brand-tertiary-500: var(--amd-red-soft);
    --color-brand-tertiary-600: var(--amd-red-primary);
    --color-brand-tertiary-700: var(--amd-red-hover);
    --color-brand-tertiary-800: color-mix(in oklab, var(--amd-red-primary) 54%, var(--amd-dark-mix));
    --color-brand-tertiary-900: color-mix(in oklab, var(--amd-red-primary) 42%, var(--amd-dark-mix));
    --color-brand-tertiary-950: color-mix(in oklab, var(--amd-red-primary) 26%, var(--amd-dark-mix));

    /* Quaternary Brand (Deep Crimson) */
    --color-brand-quaternary-50: color-mix(in oklab, var(--amd-red-active) 14%, #ffffff);
    --color-brand-quaternary-100: color-mix(in oklab, var(--amd-red-active) 28%, #ffffff);
    --color-brand-quaternary-200: color-mix(in oklab, var(--amd-red-active) 46%, #ffffff);
    --color-brand-quaternary-300: color-mix(in oklab, var(--amd-red-active) 64%, #ffffff);
    --color-brand-quaternary-400: color-mix(in oklab, var(--amd-red-active) 84%, #ffffff);
    --color-brand-quaternary-500: var(--amd-red-active);
    --color-brand-quaternary-600: color-mix(in oklab, var(--amd-red-active) 84%, var(--amd-dark-mix));
    --color-brand-quaternary-700: color-mix(in oklab, var(--amd-red-active) 68%, var(--amd-dark-mix));
    --color-brand-quaternary-800: color-mix(in oklab, var(--amd-red-active) 54%, var(--amd-dark-mix));
    --color-brand-quaternary-900: color-mix(in oklab, var(--amd-red-active) 42%, var(--amd-dark-mix));
    --color-brand-quaternary-950: color-mix(in oklab, var(--amd-red-active) 26%, var(--amd-dark-mix));

    /* Danger / Status Red */
    --color-danger-50: color-mix(in oklab, var(--amd-red-primary) 14%, #ffffff);
    --color-danger-100: color-mix(in oklab, var(--amd-red-primary) 28%, #ffffff);
    --color-danger-200: color-mix(in oklab, var(--amd-red-primary) 46%, #ffffff);
    --color-danger-300: color-mix(in oklab, var(--amd-red-primary) 64%, #ffffff);
    --color-danger-400: color-mix(in oklab, var(--amd-red-primary) 84%, #ffffff);
    --color-danger-500: var(--amd-red-primary);
    --color-danger-600: var(--amd-red-hover);
    --color-danger-700: var(--amd-red-active);
    --color-danger-800: color-mix(in oklab, var(--amd-red-primary) 54%, var(--amd-dark-mix));
    --color-danger-900: color-mix(in oklab, var(--amd-red-primary) 42%, var(--amd-dark-mix));
    --color-danger-950: color-mix(in oklab, var(--amd-red-primary) 26%, var(--amd-dark-mix));

    /* Success Status Indicator */
    --color-success-50: color-mix(in oklab, var(--amd-green) 14%, #ffffff);
    --color-success-100: color-mix(in oklab, var(--amd-green) 28%, #ffffff);
    --color-success-200: color-mix(in oklab, var(--amd-green) 46%, #ffffff);
    --color-success-300: color-mix(in oklab, var(--amd-green) 64%, #ffffff);
    --color-success-400: color-mix(in oklab, var(--amd-green) 84%, #ffffff);
    --color-success-500: var(--amd-green);
    --color-success-600: color-mix(in oklab, var(--amd-green) 84%, var(--amd-dark-mix));
    --color-success-700: color-mix(in oklab, var(--amd-green) 68%, var(--amd-dark-mix));
    --color-success-800: color-mix(in oklab, var(--amd-green) 54%, var(--amd-dark-mix));
    --color-success-900: color-mix(in oklab, var(--amd-green) 42%, var(--amd-dark-mix));
    --color-success-950: color-mix(in oklab, var(--amd-green) 26%, var(--amd-dark-mix));

    /* Warning / Amber Status Indicator */
    --color-warning-50: color-mix(in oklab, var(--amd-amber) 14%, #ffffff);
    --color-warning-100: color-mix(in oklab, var(--amd-amber) 28%, #ffffff);
    --color-warning-200: color-mix(in oklab, var(--amd-amber) 46%, #ffffff);
    --color-warning-300: color-mix(in oklab, var(--amd-amber) 64%, #ffffff);
    --color-warning-400: color-mix(in oklab, var(--amd-amber) 84%, #ffffff);
    --color-warning-500: var(--amd-amber);
    --color-warning-600: color-mix(in oklab, var(--amd-amber) 84%, var(--amd-dark-mix));
    --color-warning-700: color-mix(in oklab, var(--amd-amber) 68%, var(--amd-dark-mix));
    --color-warning-800: color-mix(in oklab, var(--amd-amber) 54%, var(--amd-dark-mix));
    --color-warning-900: color-mix(in oklab, var(--amd-amber) 42%, var(--amd-dark-mix));
    --color-warning-950: color-mix(in oklab, var(--amd-amber) 26%, var(--amd-dark-mix));
}

::selection {
    background-color: color-mix(in oklab, var(--amd-accent) 35%, transparent);
}
`
};