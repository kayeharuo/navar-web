BEGIN;
DO $cleanup$
DECLARE keep_id bigint; duplicate_ids bigint[]; before_data jsonb; actor bigint;
BEGIN
 LOCK TABLE public.brand IN SHARE ROW EXCLUSIVE MODE;
 SELECT b.brand_id INTO STRICT keep_id FROM public.brand b WHERE lower(trim(b.brand_name))='leylam' AND EXISTS(SELECT 1 FROM public.store s JOIN public.mall m USING(mall_id) WHERE s.brand_id=b.brand_id AND lower(m.mall_name) IN ('gaisano fiesta mall','sm seaside city cebu'));
 SELECT array_agg(brand_id) INTO duplicate_ids FROM public.brand WHERE lower(trim(brand_name))='leylam' AND brand_id<>keep_id;
 IF coalesce(array_length(duplicate_ids,1),0)=0 THEN RETURN;END IF;
 IF array_length(duplicate_ids,1)<>2 THEN RAISE EXCEPTION 'Expected exactly two duplicate Leylam brands; review changed data.';END IF;
 before_data:=jsonb_build_object('brands',(SELECT jsonb_agg(to_jsonb(b)) FROM public.brand b WHERE brand_id=ANY(duplicate_ids)),'stores',(SELECT jsonb_agg(to_jsonb(s)) FROM public.store s WHERE brand_id=ANY(duplicate_ids)),'stall_items',(SELECT jsonb_agg(to_jsonb(i)) FROM public.stall_expansion_item i WHERE brand_id=ANY(duplicate_ids)),'creator_links',(SELECT jsonb_agg(to_jsonb(c)) FROM app_private.brand_mall_creator c WHERE brand_id=ANY(duplicate_ids)));
 -- Keep genuine mall stores and application history; consolidate references.
 UPDATE public.store SET brand_id=keep_id WHERE brand_id=ANY(duplicate_ids);
 UPDATE public.stall_expansion_item SET brand_id=keep_id WHERE brand_id=ANY(duplicate_ids);
 INSERT INTO app_private.brand_mall_creator(brand_id,mall_id) SELECT DISTINCT keep_id,mall_id FROM app_private.brand_mall_creator WHERE brand_id=ANY(duplicate_ids) ON CONFLICT DO NOTHING;
 DELETE FROM app_private.brand_mall_creator WHERE brand_id=ANY(duplicate_ids);
 DELETE FROM public.brand WHERE brand_id=ANY(duplicate_ids);
 SELECT admin_id INTO STRICT actor FROM public.admin WHERE admin_role='super_admin' AND admin_account_status='official' AND NOT admin_is_deactivated ORDER BY admin_is_primary DESC,admin_id LIMIT 1;
 INSERT INTO public.audit_log(audit_log_module,audit_log_action,audit_log_details,audit_log_performed_at,audit_log_performed_by,audit_log_target_type,audit_log_target_id,audit_log_target_name,audit_log_metadata)
 VALUES('mall_management','duplicate_brands_merged','Removed two duplicate Leylam brands and preserved existing stores under the retained brand.',now(),actor,'brand',keep_id::text,'Leylam',jsonb_build_object('before',before_data,'retained_brand_id',keep_id));
END $cleanup$;
COMMIT;
