# Organizations, teams, RBAC

The `organization()` plugin adds multi-tenant orgs with members, invitations, roles, and (optionally) teams.

## Server

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    organization({
      // Gating
      allowUserToCreateOrganization: async (user) => user.plan === "pro", // or just `true`
      organizationLimit: 5,                          // max orgs per user

      // Invitations
      sendInvitationEmail: async ({ email, invitation, organization }, request) => {
        const url = `https://app.example.com/accept-invite?token=${invitation.id}`;
        await sendEmail({
          to: email,
          subject: `Join ${organization.name}`,
          html: `<a href="${url}">Accept invitation</a>`,
        });
      },
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7d — see recommended-defaults.md

      // Teams (optional sub-grouping inside an org)
      teams: { enabled: false },
    }),
  ],
});
```

When this plugin is enabled, `session.activeOrganizationId` becomes a first-class field — use it for authorization scoping.

## Client

```ts
import { organizationClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
```

## Create + manage organization

```ts
// Create
const { data: org } = await authClient.organization.create({
  name: "Acme Corp",
  slug: "acme",
  metadata: { industry: "software" },
  logo: "https://...",
});

// List my orgs
const { data: orgs } = await authClient.organization.list();

// Set the active org (writes to session)
await authClient.organization.setActive({ organizationId: org.id });

// Get full org with members
const { data: full } = await authClient.organization.getFullOrganization({
  organizationId: org.id,
});

// Update
await authClient.organization.update({
  organizationId: org.id,
  data: { name: "Acme Inc.", logo: "..." },
});

// Delete
await authClient.organization.delete({ organizationId: org.id });
```

## Members + invitations

```ts
// Invite
await authClient.organization.inviteMember({
  organizationId: org.id,
  email: "colleague@example.com",
  role: "member",                  // "owner" | "admin" | "member" | custom
});

// List members
const { data: members } = await authClient.organization.getMembers({
  organizationId: org.id,
});

// Accept an invitation (signed-in user opens the email link)
await authClient.organization.acceptInvitation({ invitationId: "inv_..." });

// Reject
await authClient.organization.rejectInvitation({ invitationId: "inv_..." });

// Update member role
await authClient.organization.updateMemberRole({
  organizationId: org.id,
  memberId: "mem_...",
  role: "admin",
});

// Remove
await authClient.organization.removeMember({
  organizationId: org.id,
  memberIdOrEmail: "colleague@example.com",
});

// Leave (member action)
await authClient.organization.leave({ organizationId: org.id });
```

## Custom roles via access control

Better Auth ships an `access controller` primitive (`createAccessControl`) to define roles and per-resource permissions.

```ts
// auth/permissions.ts
import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  project: ["create", "read", "update", "delete"],
  invoice: ["read", "issue", "refund"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  project: ["create", "read", "update", "delete"],
  invoice: ["read", "issue", "refund"],
});

export const admin = ac.newRole({
  project: ["create", "read", "update"],
  invoice: ["read", "issue"],
});

export const member = ac.newRole({
  project: ["read"],
  invoice: ["read"],
});

export const myCustomRole = ac.newRole({
  project: ["create", "read"],
});
```

Wire into the plugin:

```ts
import { ac, owner, admin, member, myCustomRole } from "@/auth/permissions";

betterAuth({
  plugins: [
    organization({
      ac,
      roles: { owner, admin, member, myCustomRole },
    }),
  ],
});
```

Authorization check (server):

```ts
const session = await auth.api.getSession({ headers });
const result = await auth.api.hasPermission({
  body: {
    organizationId: session.session.activeOrganizationId!,
    permissions: { invoice: ["issue"] },
  },
  headers,
});
if (!result.success) throw forbidden();
```

Client-side `authClient.organization.hasPermission({ permissions: { ... } })` is also available for UI gating (do **not** rely on it alone for authorization — always re-check on the server).

## Teams (optional)

Enable with `organization({ teams: { enabled: true } })`. Adds a `team` table and team-scoped membership.

```ts
const { data: team } = await authClient.organization.createTeam({
  organizationId: org.id,
  name: "Engineering",
});

await authClient.organization.addTeamMember({
  teamId: team.id,
  userId: "user_...",
});
```

Roles + access-control extend to teams via the same `ac.newRole(...)` pattern, scoped to team-level statements.

## SSO per organization

The SSO plugin can link a SAML/OIDC provider to an organization, so users from `@acmecorp.com` are forced through `acme-corp-saml`:

```ts
await auth.api.registerSSOProvider({
  body: {
    providerId: "acme-corp-saml",
    issuer: "https://acme-corp.okta.com",
    domain: "acmecorp.com",
    organizationId: org.id,
    samlConfig: { /* ... */ },
  },
  headers,
});
```

## `admin()` plugin (separate, app-wide)

For app-level superadmins (not org-scoped). Adds `role` and `banned` columns to `user`, and `auth.api.listUsers / banUser / setRole` endpoints.

```ts
import { admin } from "better-auth/plugins";
betterAuth({ plugins: [admin()] });
```

Use this for your internal back-office, **not** for tenant RBAC — that's what `organization()` is for.

## Anti-patterns

- ❌ Storing `role` directly on `user` for multi-tenant — breaks the moment a user joins a second org. Use `organization()` + `member.role`.
- ❌ Hard-coding role strings everywhere — use the access-control `statement` so the type system tracks permissions.
- ❌ Checking `member.role === "admin"` in the client and never re-checking on the server — RBAC bypass via DevTools.
- ❌ Letting invitations live forever — bound with `invitationExpiresIn`.
