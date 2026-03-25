/**
 * Config schema for relay page setup.
 *
 * Defines the dynamic flow for email credential collection:
 * - Entry: email address
 * - Routes: Outlook (OAuth), Gmail/Yahoo/iCloud (App Password), custom (password + IMAP host)
 */

import type { RelayConfigSchema } from '@n24q02m/mcp-relay-core/schema'

export const RELAY_SCHEMA: RelayConfigSchema = {
  server: 'better-email-mcp',
  displayName: 'Email MCP',
  dynamicFlow: {
    entryField: {
      key: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'you@gmail.com',
      required: true
    },
    routes: [
      {
        match: ['outlook.com', 'hotmail.com', 'live.com'],
        action: 'oauth2_device_code',
        message:
          'Outlook uses OAuth2 Device Code flow. Start the server and follow the sign-in instructions in the terminal.',
        oauthConfig: {}
      },
      {
        match: ['gmail.com', 'googlemail.com'],
        action: 'credentials',
        fields: [
          {
            key: 'password',
            label: 'App Password',
            type: 'password',
            placeholder: 'xxxx xxxx xxxx xxxx',
            helpUrl: 'https://myaccount.google.com/apppasswords',
            helpText: 'Generate an App Password in Google Account settings (requires 2FA enabled)',
            required: true
          }
        ]
      },
      {
        match: ['yahoo.com'],
        action: 'credentials',
        fields: [
          {
            key: 'password',
            label: 'App Password',
            type: 'password',
            helpUrl: 'https://login.yahoo.com/account/security',
            helpText: 'Generate an App Password in Yahoo Account Security settings',
            required: true
          }
        ]
      },
      {
        match: ['icloud.com', 'me.com'],
        action: 'credentials',
        fields: [
          {
            key: 'password',
            label: 'App-Specific Password',
            type: 'password',
            helpUrl: 'https://appleid.apple.com/account/manage',
            helpText: 'Generate an app-specific password at appleid.apple.com',
            required: true
          }
        ]
      },
      {
        match: ['*'],
        action: 'credentials',
        fields: [
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true
          },
          {
            key: 'imap_host',
            label: 'IMAP Server',
            type: 'text',
            placeholder: 'imap.example.com',
            helpText: 'IMAP server hostname for your email provider',
            required: true
          }
        ]
      }
    ]
  }
}
