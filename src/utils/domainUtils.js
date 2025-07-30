// Domain utility functions

/**
 * Creates a URL-safe domain from a string
 * @param {string} input - The input string to convert to a domain
 * @returns {string} - A URL-safe domain string
 */
export const createDomain = (input) => {
  if (!input) return '';
  
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '') // Remove special characters
    .replace(/\s+/g, '') // Remove spaces
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 20); // Limit length
};

/**
 * Validates a domain string
 * @param {string} domain - The domain to validate
 * @returns {boolean} - Whether the domain is valid
 */
export const isValidDomain = (domain) => {
  if (!domain) return false;
  
  // Must be 3-20 characters, only lowercase letters, numbers, and hyphens
  const domainRegex = /^[a-z0-9-]{3,20}$/;
  
  // Cannot start or end with hyphen
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  
  // Cannot have consecutive hyphens
  if (domain.includes('--')) return false;
  
  return domainRegex.test(domain);
};

/**
 * Reserved domains that cannot be used
 */
export const RESERVED_DOMAINS = [
  'www', 'api', 'admin', 'app', 'blog', 'help', 'support', 'mail', 'email',
  'ftp', 'smtp', 'pop', 'imap', 'ns1', 'ns2', 'dns', 'web', 'site', 'home',
  'login', 'logout', 'signup', 'signin', 'register', 'auth', 'oauth',
  'dashboard', 'profile', 'settings', 'account', 'user', 'users',
  'tipt', 'tiptco', 'tipt-co', 'tipt_co', 'tipt.co'
];

/**
 * Checks if a domain is reserved
 * @param {string} domain - The domain to check
 * @returns {boolean} - Whether the domain is reserved
 */
export const isReservedDomain = (domain) => {
  return RESERVED_DOMAINS.includes(domain.toLowerCase());
};

/**
 * Formats a domain for display with the .tipt.co suffix
 * @param {string} domain - The domain to format
 * @returns {string} - The formatted domain with suffix
 */
export const formatDomain = (domain) => {
  if (!domain) return '';
  return `${domain}.tipt.co`;
};

/**
 * Extracts the domain part from a full URL
 * @param {string} url - The full URL (e.g., "dylandalal.tipt.co")
 * @returns {string} - The domain part (e.g., "dylandalal")
 */
export const extractDomainFromUrl = (url) => {
  if (!url) return '';
  
  // Remove protocol if present
  const cleanUrl = url.replace(/^https?:\/\//, '');
  
  // Remove .tipt.co suffix if present
  const domain = cleanUrl.replace(/\.tipt\.co$/, '');
  
  return domain;
}; 