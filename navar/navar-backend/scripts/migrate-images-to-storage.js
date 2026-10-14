'use strict'

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const { uploadStoredImage } = require('../modules/storage/imageStorage')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

async function migrateTable(table, idColumn, legacyColumn, pathColumn, folder) {
  const result = await supabase.from(table).select(`${idColumn}, ${legacyColumn}, ${pathColumn}`)
  if (result.error) throw result.error
  let migrated = 0
  for (const row of result.data || []) {
    if (row[pathColumn] || !row[legacyColumn]) continue
    const path = `${folder}/${row[idColumn]}/image`
    await uploadStoredImage(supabase, path, row[legacyColumn])
    const updated = await supabase.from(table).update({ [pathColumn]: path }).eq(idColumn, row[idColumn])
    if (updated.error) throw updated.error
    migrated += 1
  }
  console.log(`${table}: migrated ${migrated} image(s)`)
}

async function main() {
  await migrateTable('admin', 'admin_id', 'admin_profile_picture', 'admin_profile_picture_path', 'admins')
  await migrateTable('mall', 'mall_id', 'mall_logo', 'mall_logo_path', 'malls')
  await migrateTable('brand', 'brand_id', 'brand_logo', 'brand_logo_path', 'brands')
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})