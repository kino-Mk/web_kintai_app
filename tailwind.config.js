/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'media',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#3498db',
                    dark: '#2980b9',
                    light: '#ebf5fb'
                },
                success: {
                    DEFAULT: '#27ae60',
                    bg: '#e8f5e9'
                },
                danger: {
                    DEFAULT: '#e74c3c',
                    bg: '#fdedec'
                },
                warning: {
                    DEFAULT: '#f39c12',
                    bg: '#fcf3cf'
                }
            }
        },
    },
    plugins: [],
}
