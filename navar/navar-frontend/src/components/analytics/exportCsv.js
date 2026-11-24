const HEADERS=['Section','Range Start','Range End','Metric','Mall ID','Mall','City','Date','Hour','Rank','Category','Value','Unit','Status','Notes']
const label=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^\w/,c=>c.toUpperCase())
function cell(value){
  if(value==null)return '""'
  let text=typeof value==='number'?(Number.isFinite(value)?String(value):''):String(value)
  if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text
  return '"'+text.replaceAll('"','""')+'"'
}
export function analyticsCsv(report){
  const rows=[HEADERS]
  const add=(section,metric,value,unit='',e={})=>rows.push([section,report.range.from,report.range.to,metric,e.mallId,e.mall,e.city,e.date,e.hour,e.rank,e.category,value,unit,e.status,e.notes])
  const empty=section=>add(section,'Availability',null,'',{notes:'No recorded data for the selected period.'})
  add('Report','Generated at',report.generatedAt,'ISO 8601');add('Report','Time zone',report.range.timeZone)
  for(const [key,value]of Object.entries(report.definitions))add('Definitions',label(key),value)
  for(const [key,value]of Object.entries(report.summary))if(value==null||typeof value!=='object')add('Summary',label(key),value,/Value|Payments/.test(key)?'PHP':/Seconds/.test(key)?'seconds':'')
  add('Summary','Top mall sessions',report.summary.topMall?.sessions,'sessions',{mall:report.summary.topMall?.name})
  add('Summary','Top destination sessions',report.summary.topDestination?.value,'sessions',{category:report.summary.topDestination?.label})
  for(const d of report.sessionsOverTime)add('Sessions Over Time','Navigation sessions',d.sessions,'sessions',{date:d.date})
  if(!report.mallPerformance.length)empty('Mall Performance')
  for(const m of report.mallPerformance){const e={mallId:m.id,mall:m.name,city:m.city};add('Mall Performance','Sessions',m.sessions,'sessions',e);add('Mall Performance','Recorded payments',m.revenue,'PHP',e)}
  for(const h of report.peakHours)add('Peak Hours','Sessions by start hour',h.value,'sessions',{hour:h.hour,notes:h.peak?'Peak hour':''})
  if(!report.topDestinations.length)empty('Top Destinations')
  for(const d of report.topDestinations)add('Top Destinations','Navigations',d.value,'sessions',{category:d.label})
  for(const [key,value]of Object.entries(report.userType))add('User Type',label(key),value,'users')
  for(const m of report.monthlyRevenue){add('Monthly Payments','Recorded payments',m.value,'PHP',{date:m.month});add('Monthly Payments','Payment count',m.payments,'payments',{date:m.month})}
  if(!report.paymentTypes.length)empty('Payment Types')
  for(const p of report.paymentTypes)add('Payment Types','Recorded payments',p.value,'PHP',{category:p.label})
  if(!report.mallBreakdown.length)empty('Mall Breakdown')
  for(const m of report.mallBreakdown){const e={mallId:m.id,mall:m.name,city:m.city,status:m.status};for(const [key,unit]of [['sessions','sessions'],['last7','sessions'],['previous7','sessions'],['changePercent','percent'],['annualFee','PHP'],['revenue','PHP'],['topDestination',''],['isLive','boolean']])add('Mall Breakdown',key==='revenue'?'Recorded Payments':label(key),m[key],unit,e)}
  if(!report.topStores.length)empty('Top Stores')
  for(const s of report.topStores)add('Top Stores','Navigations',s.value,'sessions',{mallId:s.mallId,mall:s.mall,rank:s.rank,category:s.name})
  for(const [key,value]of Object.entries(report.quality))add('Data Quality',label(key),value,'records')
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
