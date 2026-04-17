/**
 * @typedef {Object} BusinessSection
 * @property {string} id
 * @property {string} key
 * @property {'hero'|'links'|'services'|'contact'|'wifi'|'pix'|'social'|'map'|'gallery'|'reviews'|'cta'|'custom'} type
 * @property {number} order
 * @property {boolean} visible
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [variant]
 * @property {Record<string, any>} settings
 * @property {Array<Record<string, any>>} items
 */

/**
 * @typedef {Object} PublicSitePayload
 * @property {import('./business.js').Business} business
 * @property {import('./business.js').ThemeTokens} theme
 * @property {BusinessSection[]} sections
 * @property {Array<Record<string, any>>} links
 * @property {Object} seo
 */

export {};

