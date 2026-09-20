begin;
select plan(4);

select ok(has_table_privilege('service_role', 'public.profiles', 'SELECT'), 'service role can inspect profiles for backend jobs');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'SELECT'), 'reminder job can read push subscriptions');
select ok(has_table_privilege('service_role', 'public.push_subscriptions', 'DELETE'), 'reminder job can remove expired subscriptions');
select ok(has_table_privilege('service_role', 'public.notifications', 'INSERT'), 'reminder job can create in-app notifications');

select * from finish();
rollback;
