create type "public"."session_mode" as enum ('loop', 'chop');

create table "public"."recordings" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "session_id" uuid not null,
    "recording_url" text not null,
    "length" real,
    "notes" text,
    "created_at" timestamp with time zone default now()
);


alter table "public"."recordings" enable row level security;

create table "public"."sessions" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "session_name" text not null,
    "track_ids" uuid[] default '{}'::uuid[],
    "cuepoints" jsonb default '[]'::jsonb,
    "loop_regions" jsonb default '[]'::jsonb,
    "mode" session_mode default 'loop'::session_mode,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."sessions" enable row level security;

create table "public"."uploads" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid not null,
    "file_url" text not null,
    "title" text not null,
    "duration" real,
    "created_at" timestamp with time zone default now()
);


alter table "public"."uploads" enable row level security;

create table "public"."users" (
    "id" uuid not null,
    "access_tier" text default 'free'::text,
    "stripe_customer_id" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "subscription_id" text,
    "plan_interval" text,
    "price_id" text
);


alter table "public"."users" enable row level security;

CREATE INDEX idx_recordings_session_id ON public.recordings USING btree (session_id);

CREATE INDEX idx_recordings_user_id ON public.recordings USING btree (user_id);

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

CREATE INDEX idx_uploads_user_id ON public.uploads USING btree (user_id);

CREATE INDEX idx_users_access_tier ON public.users USING btree (access_tier);

CREATE INDEX idx_users_stripe_customer_id ON public.users USING btree (stripe_customer_id);

CREATE INDEX idx_users_subscription_id ON public.users USING btree (subscription_id);

CREATE UNIQUE INDEX recordings_pkey ON public.recordings USING btree (id);

CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id);

CREATE UNIQUE INDEX uploads_pkey ON public.uploads USING btree (id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."recordings" add constraint "recordings_pkey" PRIMARY KEY using index "recordings_pkey";

alter table "public"."sessions" add constraint "sessions_pkey" PRIMARY KEY using index "sessions_pkey";

alter table "public"."uploads" add constraint "uploads_pkey" PRIMARY KEY using index "uploads_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."recordings" add constraint "recordings_session_id_fkey" FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE not valid;

alter table "public"."recordings" validate constraint "recordings_session_id_fkey";

alter table "public"."recordings" add constraint "recordings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."recordings" validate constraint "recordings_user_id_fkey";

alter table "public"."sessions" add constraint "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."sessions" validate constraint "sessions_user_id_fkey";

alter table "public"."uploads" add constraint "uploads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE not valid;

alter table "public"."uploads" validate constraint "uploads_user_id_fkey";

alter table "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."users" validate constraint "users_id_fkey";

alter table "public"."users" add constraint "users_plan_interval_check" CHECK ((plan_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))) not valid;

alter table "public"."users" validate constraint "users_plan_interval_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, access_tier)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."recordings" to "anon";

grant insert on table "public"."recordings" to "anon";

grant references on table "public"."recordings" to "anon";

grant select on table "public"."recordings" to "anon";

grant trigger on table "public"."recordings" to "anon";

grant truncate on table "public"."recordings" to "anon";

grant update on table "public"."recordings" to "anon";

grant delete on table "public"."recordings" to "authenticated";

grant insert on table "public"."recordings" to "authenticated";

grant references on table "public"."recordings" to "authenticated";

grant select on table "public"."recordings" to "authenticated";

grant trigger on table "public"."recordings" to "authenticated";

grant truncate on table "public"."recordings" to "authenticated";

grant update on table "public"."recordings" to "authenticated";

grant delete on table "public"."recordings" to "service_role";

grant insert on table "public"."recordings" to "service_role";

grant references on table "public"."recordings" to "service_role";

grant select on table "public"."recordings" to "service_role";

grant trigger on table "public"."recordings" to "service_role";

grant truncate on table "public"."recordings" to "service_role";

grant update on table "public"."recordings" to "service_role";

grant delete on table "public"."sessions" to "anon";

grant insert on table "public"."sessions" to "anon";

grant references on table "public"."sessions" to "anon";

grant select on table "public"."sessions" to "anon";

grant trigger on table "public"."sessions" to "anon";

grant truncate on table "public"."sessions" to "anon";

grant update on table "public"."sessions" to "anon";

grant delete on table "public"."sessions" to "authenticated";

grant insert on table "public"."sessions" to "authenticated";

grant references on table "public"."sessions" to "authenticated";

grant select on table "public"."sessions" to "authenticated";

grant trigger on table "public"."sessions" to "authenticated";

grant truncate on table "public"."sessions" to "authenticated";

grant update on table "public"."sessions" to "authenticated";

grant delete on table "public"."sessions" to "service_role";

grant insert on table "public"."sessions" to "service_role";

grant references on table "public"."sessions" to "service_role";

grant select on table "public"."sessions" to "service_role";

grant trigger on table "public"."sessions" to "service_role";

grant truncate on table "public"."sessions" to "service_role";

grant update on table "public"."sessions" to "service_role";

grant delete on table "public"."uploads" to "anon";

grant insert on table "public"."uploads" to "anon";

grant references on table "public"."uploads" to "anon";

grant select on table "public"."uploads" to "anon";

grant trigger on table "public"."uploads" to "anon";

grant truncate on table "public"."uploads" to "anon";

grant update on table "public"."uploads" to "anon";

grant delete on table "public"."uploads" to "authenticated";

grant insert on table "public"."uploads" to "authenticated";

grant references on table "public"."uploads" to "authenticated";

grant select on table "public"."uploads" to "authenticated";

grant trigger on table "public"."uploads" to "authenticated";

grant truncate on table "public"."uploads" to "authenticated";

grant update on table "public"."uploads" to "authenticated";

grant delete on table "public"."uploads" to "service_role";

grant insert on table "public"."uploads" to "service_role";

grant references on table "public"."uploads" to "service_role";

grant select on table "public"."uploads" to "service_role";

grant trigger on table "public"."uploads" to "service_role";

grant truncate on table "public"."uploads" to "service_role";

grant update on table "public"."uploads" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

create policy "Users can delete their own recordings"
on "public"."recordings"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own recordings"
on "public"."recordings"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own recordings"
on "public"."recordings"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own recordings"
on "public"."recordings"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can delete their own sessions"
on "public"."sessions"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own sessions"
on "public"."sessions"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own sessions"
on "public"."sessions"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own sessions"
on "public"."sessions"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can delete their own uploads"
on "public"."uploads"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own uploads"
on "public"."uploads"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own uploads"
on "public"."uploads"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own uploads"
on "public"."uploads"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own data"
on "public"."users"
as permissive
for insert
to public
with check ((auth.uid() = id));


create policy "Users can update their own data"
on "public"."users"
as permissive
for update
to public
using ((auth.uid() = id));


create policy "Users can view their own data"
on "public"."users"
as permissive
for select
to public
using ((auth.uid() = id));


CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


