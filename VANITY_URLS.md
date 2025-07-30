# Vanity URLs Implementation

This document explains how the vanity URL system works in the Tipt application.

## Overview

Users can now have custom vanity URLs like `dylandalal.tipt.co` instead of the default Firebase UID-based URLs.

## How It Works

### 1. Domain Field
- Users enter a custom domain in the signup and edit profile forms
- The domain field is separate from the "Alt Name" field
- Domains are automatically converted to URL-safe format (lowercase, no special characters)

### 2. Domain Validation
- **Format**: 3-20 characters, lowercase letters, numbers, and hyphens only
- **Reserved**: Cannot use reserved domains like "www", "api", "admin", etc.
- **Uniqueness**: Each domain must be unique across all users
- **Real-time checking**: Availability is checked as users type

### 3. Routing
The app supports multiple URL formats:
- `/profile/:uid` - Legacy Firebase UID-based URLs
- `/profile/:identifier` - Generic identifier (UID or domain)
- `/:domain` - Direct domain-based URLs (e.g., `dylandalal.tipt.co`)

### 4. Database Structure
```javascript
// User document in Firestore
{
  uid: "firebase-uid-here",
  domain: "dylandalal",
  firstName: "Dylan",
  lastName: "Lalal",
  altName: "Dylan Lalal",
  // ... other fields
}
```

## Implementation Details

### Domain Utilities (`src/utils/domainUtils.js`)
- `createDomain(input)` - Converts input to URL-safe domain
- `isValidDomain(domain)` - Validates domain format
- `isReservedDomain(domain)` - Checks if domain is reserved
- `formatDomain(domain)` - Adds `.tipt.co` suffix for display

### Form Integration
- **SignupWizard**: New users must choose a unique domain
- **EditProfile**: Existing users can change their domain
- Real-time availability checking with debounced API calls

### Routing Logic
- Profile component detects if the identifier is a Firebase UID or domain
- Firebase UIDs: 28 characters, alphanumeric
- Domains: Variable length, URL-safe format
- Falls back to domain search if UID lookup fails

## Setup Requirements

### 1. Domain Registration
- Purchase `tipt.co` domain
- Configure DNS to point to Netlify

### 2. Netlify Configuration
The `netlify.toml` file includes redirects for domain-based routing:
```toml
[[redirects]]
  from = "/:domain"
  to = "/index.html"
  status = 200
```

### 3. Firestore Index
Create an index on the `domain` field for efficient queries:
```json
{
  "collectionGroup": "recipients",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "domain",
      "order": "ASCENDING"
    }
  ]
}
```

## Migration Strategy

For existing users:
1. Add `domain` field to existing user documents
2. Generate domains from `altName` or let users choose
3. Maintain backward compatibility with UID-based URLs

## Security Considerations

- Domain validation prevents injection attacks
- Reserved domains prevent conflicts with system routes
- Uniqueness enforced at database level
- Input sanitization prevents XSS

## Future Enhancements

- Domain transfer between users
- Domain expiration/renewal
- Premium domains
- Domain analytics
- Custom subdomains 