-- A simma cooks the three deep-water fish as well, as the browser's `cookRecipes` has it: cod, halibut and bluefin.
create or replace function tend_recipes(p_kind text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $fn$
  select case p_kind
    when 'tan' then array['tan_hide']
    when 'mill' then array['make_flour', 'make_cornmeal', 'press_olives']
    when 'saw' then array['make_planks']
    when 'chisel' then array['make_stone_brick']
    when 'brick' then array['make_clay_brick']
    when 'fletch' then array['make_arrows']
    when 'concrete' then array['mix_concrete']
    when 'mortar' then array['make_mortar']
    when 'timber' then array['make_timbers']
    when 'shaft' then array['make_shafts']
    when 'bandage' then array['make_bandage', 'make_cover_thyme', 'make_cover_basil', 'make_cover_mint', 'make_cover_sage',
                              'make_cover_rosemary', 'make_salve_thyme', 'make_salve_basil', 'make_salve_mint', 'make_salve_sage',
                              'make_salve_rosemary']
    when 'cheese' then array['make_cheese']
    when 'paper' then array['make_papyrus']
    when 'spin' then array['spin_wool', 'spin_cotton', 'spin_wemp']
    when 'churn' then array['churn_butter']
    when 'glass' then array['make_glass']
    when 'alloy' then array['make_bronze', 'make_brass', 'make_steel', 'make_pewter', 'make_electrum']
    when 'ash' then array['make_lye']
    when 'cook' then array['cook_meat', 'bake_potato', 'roast_onion', 'roast_nuts', 'roast_lotus_seeds', 'make_compote',
                           'fry_meat', 'make_pottage', 'make_preserves', 'bake_bread', 'make_porridge', 'bake_pastry',
                           'make_apple_pie', 'make_stew', 'cook_minnow', 'cook_perch', 'cook_trout',
                           'cook_pike', 'cook_sturgeon', 'cook_cod', 'cook_halibut', 'cook_bluefin'] end
$fn$
;

select private.lock_doors();
