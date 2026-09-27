# 2-Wheeler Parking Allocation — Safari/Chrome website

This package is the web version of the society parking allocation system. It is designed for:
- iPhone Safari
- Android Chrome
- Desktop Chrome/Edge/Safari
- 92 members
- 18 pre-allocated members
- 74 members who must select
- 77 selectable slots
- 3 slots remaining after all 74 selections
- strict sequential selection by `Sr No`
- automatic skipping of pre-allocated members
- atomic slot locking so two phones cannot select the same slot

## Important privacy rule

Do NOT upload `private_setup.sql` or `member_access_codes.csv` to a public GitHub repository.

The public website contains only the application code and parking layout image. Member records and access codes stay in Supabase.

## Setup

1. Create a free Supabase project.
2. Open Supabase → SQL Editor.
3. Paste the entire contents of `private_setup.sql` and run it.
4. In Supabase → Authentication → Users, create ONE administrator email/password.
5. Copy the administrator user's UUID.
6. In SQL Editor run:
   `insert into public.admin_users(user_id) values ('PASTE-ADMIN-UUID-HERE');`
7. Copy `config.example.js` to a new file named `config.js`.
8. Put your Supabase Project URL and anon/public key into `config.js`.
9. Upload only these public files to your website host:
   `index.html`, `admin.html`, `app.js`, `admin.js`, `styles.css`, `config.js`, `parking-map.jpg`.
10. Keep `private_setup.sql` and `member_access_codes.csv` private.

## Easiest free hosting

GitHub Pages is suitable for the public application code. The repository can be public because no member list or access-code list is stored in the website.

After publishing, open the GitHub Pages address in Safari/Chrome. Members use the same website address and enter their flat number + private access code.

## Member access codes

`member_access_codes.csv` contains a unique code for each of the 92 flats. Send each member only their own code.

For example:
Flat: A-1204
Code: XXXX-XXXX-XXXX

The database stores only a SHA-256 hash of each code.

## Testing before the real allocation

Use two phones:
1. Log in as the current eligible member.
2. Leave the slot list open on the second phone.
3. Select a slot on the first phone.
4. Confirm that the second phone sees the slot become allocated and that the current index advances.
5. Test admin pause.
6. Test admin undo.

Do not run the real allocation until this test is successful.
