/**
 * Identity + cross-site links for board.akibh.dev. Mirrors the shape of
 * akiblog's data/site.ts so the shared head/footer markup stays identical.
 */
export const site = {
  name: 'Notice Board',
  tagline: 'Bangladesh government job circulars in one table.',
  description:
    'Bangladesh government recruitment notices from Teletalk, Bangladesh Bank e-Recruitment and more, in one searchable table. Every row links to the official notice.',
  url: 'https://board.akibh.dev',
  author: { name: 'Md Akib Hasan', email: 'hello@akibh.dev' },
  /** owner's site — only used for JSON-LD publisher identity, not linked in the UI */
  portfolioUrl: 'https://akibh.dev',
} as const;
