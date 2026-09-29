UPDATED 2-WHEELER PARKING WEBSITE

Changes in this package:
1. Member confirmation now shows the approved numbered Terms & Conditions.
2. The member must tick the agreement checkbox before the confirmation button is enabled.
3. The database records agreement_accepted=true, terms_version=v1.0 and agreed_at at the time of selection.
4. The Admin allocation register shows separate Date and Time columns in IST (Asia/Kolkata).

DEPLOYMENT ORDER
A. In Supabase SQL Editor, run SUPABASE_TERMS_UPDATE.sql once.
B. In GitHub, replace the existing public website files with the files in this ZIP.
C. Do NOT upload SUPABASE_TERMS_UPDATE.sql, private_setup.sql, member_access_codes.csv, members.csv, or any access-code file to GitHub.
D. Test with one account only. Do not make a real selection until the terms dialog and admin timestamp have been checked.

IMPORTANT
The SQL migration does not recreate/delete the existing tables or member data.
The existing allocation records remain intact.
