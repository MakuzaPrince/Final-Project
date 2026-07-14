/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Gray scale including 950 (Tailwind default is missing it from older versions)
                gray: {
                    50: '#f9fafb',
                    100: '#f3f4f6',
                    200: '#e5e7eb',
                    300: '#d1d5db',
                    400: '#9ca3af',
                    500: '#6b7280',
                    600: '#4b5563',
                    700: '#374151',
                    800: '#1f2937',
                    900: '#111827',
                    950: '#030712',
                },
                // RRA (Rwanda Revenue Authority) official brand palette
                // Extracted from rra_log.jpg:
                //   Background: medium cornflower blue
                //   Logo text "RRA": gold/amber
                //   Splash elements: green, white, gold
                rra: {
                    blue: '#1E6BB5',       // Primary RRA blue (logo background)
                    'blue-dark': '#155090', // Darker shade for hover/depth
                    'blue-light': '#E8F2FC', // Tint for light-mode backgrounds
                    gold: '#F5A100',        // RRA gold/amber (logo text + splashes)
                    'gold-dark': '#D48A00', // Darker gold for hover states
                    'gold-light': '#FEF3DC', // Gold tint for backgrounds
                    green: '#38B038',       // RRA green (logo splashes)
                    'green-light': '#E8F7E8',// Green tint
                },
            },
        },
    },
    plugins: [],
}
