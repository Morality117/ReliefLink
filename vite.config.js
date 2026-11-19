import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "fs";

function copyApiJsPlugin() {
  return {
    name: "copy-api-js",
    closeBundle() {
      const destDir = resolve(__dirname, "dist/js");
      mkdirSync(destDir, { recursive: true });
      copyFileSync(resolve(__dirname, "js/api.js"), resolve(destDir, "api.js"));
    },
  };
}

export default defineConfig({
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    open: "/Homepage/index.html",
  },
  plugins: [copyApiJsPlugin()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        home: resolve(__dirname, "Homepage/index.html"),
        login: resolve(__dirname, "LoginSignupPage/login.html"),
        signup: resolve(__dirname, "LoginSignupPage/signup.html"),
        citizen: resolve(__dirname, "Dashboards/citizen-dashboard.html"),
        volunteer: resolve(__dirname, "Dashboards/volunteer-dashboard.html"),
        admin: resolve(__dirname, "Dashboards/admin-dashboard.html"),
        request: resolve(__dirname, "Dashboards/request.html"),
        chat: resolve(__dirname, "Dashboards/chat.html"),
      },
    },
  },
});
