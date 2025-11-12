import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const GITHUB_URL = 'https://github.com/kneelinghorse/Cross-Protocol-Manifest-System';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  title: 'Cross-Protocol Manifest System',
  tagline: 'Manifest-first framework for data, API, event, and agent contracts.',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
    experimental_faster: true,
  },
  url: 'https://cross-protocol.dev',
  baseUrl: '/',
  organizationName: 'kneelinghorse',
  projectName: 'Cross-Protocol-Manifest-System',
  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: `${GITHUB_URL}/tree/main/docs/docs/`,
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'community',
        path: 'community',
        routeBasePath: 'community',
        sidebarPath: undefined,
        editUrl: `${GITHUB_URL}/tree/main/docs/community/`,
        showLastUpdateAuthor: true,
        showLastUpdateTime: true,
      },
    ],
    function protocolAliasPlugin() {
      const protocolPackages = ['data', 'event', 'api', 'agent', 'semantic'] as const;
      const aliasMap = protocolPackages.reduce<Record<string, string>>((aliases, pkg) => {
        const distEntry = path.resolve(__dirname, `../packages/${pkg}/dist/index.js`);
        const srcEntry = path.resolve(__dirname, `../packages/${pkg}/src/index.ts`);
        const resolved = fs.existsSync(distEntry) ? distEntry : srcEntry;
        aliases[`@cpms/${pkg}`] = resolved;
        aliases[`@proto/${pkg}`] = resolved; // backward compatibility with older docs/examples
        return aliases;
      }, {});

      return {
        name: 'protocol-alias-plugin',
        configureWebpack() {
          return {
            resolve: {
              alias: aliasMap,
            },
          };
        },
      };
    },
  ],
  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
      defaultMode: 'light',
    },
    navbar: {
      title: 'CPMS',
      logo: {
        alt: 'Cross-Protocol Manifest System',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/community/contributing',
          label: 'Community',
          position: 'left',
        },
        {
          to: '/playground',
          label: 'Live Playground',
          position: 'left',
        },
        {
          href: GITHUB_URL,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Start Here',
          items: [
            {label: 'Overview', to: '/docs/getting-started/overview'},
            {label: 'Installation', to: '/docs/getting-started/installation'},
            {label: 'Playground', to: '/playground'},
          ],
        },
        {
          title: 'Protocols',
          items: [
            {label: 'Data', to: '/docs/protocols/data-protocol'},
            {label: 'Event', to: '/docs/protocols/event-protocol'},
            {label: 'API', to: '/docs/protocols/api-protocol'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'Contributing', to: '/community/contributing'},
            {label: 'Changelog', to: '/community/changelog'},
            {label: 'Code of Conduct', to: '/community/code-of-conduct'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Cross-Protocol Manifest System. Built with Docusaurus.`,
    },
    algolia: {
      appId: process.env.DOCSEARCH_APP_ID ?? 'DOCSEARCH_APP_ID',
      apiKey: process.env.DOCSEARCH_API_KEY ?? 'DOCSEARCH_API_KEY',
      indexName: 'cpms_docs',
      contextualSearch: true,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
