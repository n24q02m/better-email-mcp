/**
 * OAuth Provider Configurations
 * Well-known OAuth endpoints for supported email providers
 */

export interface OAuthProviderConfig {
  name: string
  authorizationEndpoint: string
  tokenEndpoint: string
  scopes: string[]
  /** Domains that map to this provider */
  domains: string[]
}

export const GOOGLE_PROVIDER: OAuthProviderConfig = {
  name: 'google',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scopes: ['https://mail.google.com/'],
  domains: ['gmail.com', 'googlemail.com']
}

export const MICROSOFT_PROVIDER: OAuthProviderConfig = {
  name: 'microsoft',
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: [
    'https://outlook.office365.com/IMAP.AccessAsUser.All',
    'https://outlook.office365.com/SMTP.Send',
    'offline_access'
  ],
  domains: ['outlook.com', 'hotmail.com', 'live.com']
}

const PROVIDERS: OAuthProviderConfig[] = [GOOGLE_PROVIDER, MICROSOFT_PROVIDER]

/**
 * Detect OAuth provider from email domain
 */
export function detectProvider(email: string): OAuthProviderConfig | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null

  for (const provider of PROVIDERS) {
    if (provider.domains.includes(domain)) return provider
    for (const d of provider.domains) {
      if (domain.endsWith(`.${d}`)) return provider
    }
  }

  return null
}

/**
 * Check if an email domain supports OAuth
 */
export function isOAuthSupported(email: string): boolean {
  return detectProvider(email) !== null
}
