-- 2-Wheeler Parking: terms acceptance + IST display support
-- Run this in Supabase SQL Editor AFTER the original private_setup.sql has been run.
-- This is a migration only. It does NOT recreate or delete existing member/slot data.
-- DO NOT upload this SQL file to the public GitHub repository.

-- 1) Record the member's acceptance against each selection allocation.
alter table public.allocations
  add column if not exists agreement_accepted boolean not null default false,
  add column if not exists terms_version text,
  add column if not exists agreed_at timestamptz;

-- Existing preallocated/old rows are left as false/NULL because the new agreement
-- applies to selections made through the updated member website.

-- 2) Replace the selection RPC. The website must send p_agree=true.
drop function if exists public.select_parking_slot(text,text,text);

create or replace function public.select_parking_slot(
  p_flat text,
  p_code text,
  p_slot text,
  p_agree boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  m public.members;
  st public.allocation_state;
  slot_row public.parking_slots;
  next_idx integer;
  norm_code text;
  agreement_time timestamptz;
  terms_version_value text := 'v1.0';
begin
  norm_code := upper(regexp_replace(trim(p_code), '[^A-Z0-9]', '', 'g'));

  if coalesce(p_agree, false) is not true then
    return jsonb_build_object('ok', false, 'message', 'You must agree to the Terms & Conditions before confirming the slot.');
  end if;

  select * into st
  from public.allocation_state
  where id=1
  for update;

  if st.is_paused then
    return jsonb_build_object('ok', false, 'message', 'Selection is temporarily paused by the administrator.');
  end if;

  select * into m
  from public.members
  where flat_number=upper(trim(p_flat))
    and token_hash=encode(digest(norm_code, 'sha256'),'hex')
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Invalid flat number or access code.');
  end if;

  if m.pre_allocated_slot is not null then
    return jsonb_build_object('ok', false, 'message', 'This flat already has a pre-allocated slot.');
  end if;

  if m.selected_slot is not null then
    return jsonb_build_object('ok', false, 'message', 'A slot has already been selected for this flat.', 'slot', m.selected_slot);
  end if;

  if m.selection_index <> st.current_index then
    return jsonb_build_object('ok', false, 'message', 'It is not your turn yet.', 'current_index', st.current_index);
  end if;

  select * into slot_row
  from public.parking_slots
  where slot_number=upper(trim(p_slot))
  for update;

  if not found or slot_row.status <> 'available' then
    return jsonb_build_object('ok', false, 'message', 'That slot is no longer available. Please choose another available slot.');
  end if;

  agreement_time := now();

  update public.parking_slots
  set status='allocated', allocated_index=m.selection_index, updated_at=agreement_time
  where slot_number=slot_row.slot_number;

  update public.members
  set selected_slot=slot_row.slot_number
  where selection_index=m.selection_index;

  insert into public.allocations(
    selection_index,
    flat_number,
    slot_number,
    allocation_type,
    allocated_at,
    agreement_accepted,
    terms_version,
    agreed_at
  )
  values (
    m.selection_index,
    m.flat_number,
    slot_row.slot_number,
    'selection',
    agreement_time,
    true,
    terms_version_value,
    agreement_time
  );

  select min(selection_index) into next_idx
  from public.members
  where pre_allocated_slot is null and selected_slot is null;

  update public.allocation_state
  set current_index=next_idx, updated_at=agreement_time
  where id=1;

  return jsonb_build_object(
    'ok', true,
    'message', 'Slot allocated successfully.',
    'slot', slot_row.slot_number,
    'completed_index', m.selection_index,
    'next_index', next_idx,
    'agreed_at', agreement_time,
    'terms_version', terms_version_value
  );
end;
$$;

-- Keep the function callable by the anonymous member website role.
grant execute on function public.select_parking_slot(text,text,text,boolean) to anon, authenticated;

-- 3) The old 3-argument RPC is intentionally removed so the member site cannot
-- bypass the Terms & Conditions by calling the previous signature.

-- Verification queries (optional):
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='allocations'
-- order by ordinal_position;
--
-- select proname, pg_get_function_identity_arguments(oid)
-- from pg_proc where proname='select_parking_slot';
