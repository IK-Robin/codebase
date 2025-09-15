# MiniCMS Pro (Auth + Published Frontend)

A **static** HTML/CSS/JS project that adds **Firebase Auth + Firestore** to your MiniCMS:
- **Auth required** to read posts (frontend).
- **Only admins** can create/edit/delete posts (admin page).
- **Frontend page** shows **published** posts only, with **copy buttons for code** and **no editing**.

## Files
- `index.html` — frontend (sign-in required; lists & reads published posts only)
- `frontend.js` — fetch + render published posts; copy code buttons
- `admin.html` — admin-only CMS
- `admin.js` — CRUD + preview; admin gating
- `styles.css` — shared styling
- `config.sample.js` — copy to `config.js` and fill Firebase config

## Quick Start
1. Create a Firebase project → enable **Authentication** (Google + Email/Password) and **Firestore**.
2. Copy `config.sample.js` → `config.js` and paste your config.
3. Host these files on GitHub Pages (or any static host).

## Admin Access (client + rules)
- In `config.js`, optionally list allowed emails: `window.ADMIN_EMAILS = ["you@example.com"]`.
- **Enforce on Firestore with security rules** (see below). Consider a `roles/{uid}` doc with `{role:"admin"}`.

## Firestore Data
Collection: `posts`
```json
{
  "title": "string",
  "slug": "string",
  "tags": ["array"],
  "description": "string",
  "blocks": [
    {"type":"text","text":"..."},
    {"type":"code","lang":"js","caption":"opt","code":"..."},
    {"type":"divider"}
  ],
  "status": "draft|published",
  "created": "ISO",
  "updated": "ISO",
  "authorUid": "uid"
}
```

## Security Rules (example)
This uses a `roles/{uid}` doc to mark admins. Publish-only readable by signed-in users.

```
// Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return exists(/databases/$(database)/documents/roles/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'admin';
    }

    match /posts/{postId} {
      allow read: if isSignedIn() && resource.data.status == "published";
      allow create, update, delete: if isAdmin();
    }

    match /roles/{uid} {
      // Only admins can manage roles (lock this down out-of-band in real setups)
      allow read: if isAdmin();
      allow write: if false;
    }
  }
}
```

> Tip: You can seed `roles/{uid}` by writing the doc once from the Firebase Console or using a temporary admin script.

## Frontend Behavior
- Requires sign-in; once signed in, loads `posts` where `status == "published"` sorted by `updated` desc.
- Click a card → open a single post view.
- **Code blocks** render inside `<pre><code>` with a **“Copy code”** button (no editing controls).

## Admin Behavior
- Requires sign-in + admin check (email list OR `roles` doc).
- Create/Edit/Delete posts; toggle **Draft/Published**.
- Live preview; content is stored in Firestore.
- Export/Import JSON (writes imported items to Firestore).

## Notes
- This is still a static site. Auth + Firestore do all the dynamic work.
- You can add more block types (image, quote) by extending both `admin.js` render & `frontend.js` render.

Enjoy! 🔐
